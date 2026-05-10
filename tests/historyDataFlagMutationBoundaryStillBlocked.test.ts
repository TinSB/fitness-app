import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const approvedDataHealthDismissFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
]);

const approvedHistoryDataFlagFiles = new Set([
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
]);

const forbiddenBrowserMutationRoutes = [
  '/history/:id/edit',
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const blockedNodeOnlyTokens = [
  'node:http',
  'node:sqlite',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
];

const broadMutationClientPaths = [
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
  'src/devApi/devApiMutationClient.ts',
];

const collectFilesIfDirectory = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return collectFilesIfDirectory(next);
    return /\.(ts|tsx)$/.test(entry.name) ? [next] : [];
  });
};

const srcRuntimeEntries = () =>
  collectSrcRuntimeFiles().map((file) => [relativePath(file), stripComments(readFileSync(file, 'utf8'))] as const);

describe('history data-flag mutation prototype keeps remaining routes blocked', () => {
  it('keeps implemented browser mutation routes limited to DataHealth dismiss and History data-flag', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const [path, source] of srcRuntimeEntries()) {
      if (!approvedDataHealthDismissFiles.has(path)) {
        expect(source, `${path} should not contain DataHealth dismiss mutation route`).not.toContain('/data-health/issues/');
      }
      if (!approvedHistoryDataFlagFiles.has(path)) {
        expect(source, `${path} should not contain History data-flag mutation route`).not.toContain('/history/:id/data-flag');
        expect(source, `${path} should not contain dynamic History data-flag route`).not.toMatch(/\/history\/\$\{[^}]+}\/*data-flag/);
      }
      if (!approvedDataHealthDismissFiles.has(path) && !approvedHistoryDataFlagFiles.has(path)) {
        expect(source, `${path} should not issue browser POST requests`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('does not add blocked route calls to App/browser source', () => {
    const app = stripComments(readSource('src/App.tsx'));
    expect(app).not.toContain('/history/:id/data-flag');
    expect(app).not.toMatch(/fetch\s*\(/);
    expect(app).not.toMatch(/method\s*:\s*['"`]POST['"`]/);

    for (const [path, source] of srcRuntimeEntries()) {
      for (const route of forbiddenBrowserMutationRoutes) {
        expect(source, `${path} should not contain ${route}`).not.toContain(route);
      }
    }
  });

  it('keeps the read-only client GET-only with no mutation methods', () => {
    const source = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const client = createDevApiReadOnlyClient({
      enabled: true,
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    expect(Object.keys(client)).toEqual([
      'readHealth',
      'readAppDataSummary',
      'readSessionsSummary',
      'readHistory',
      'readHistoryDetail',
      'readDataHealthSummary',
    ]);
    expect(Object.keys(client).join(' ')).not.toMatch(/post|put|patch|delete|mutat|dataFlag|edit|repair|start|complete|discard/i);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);

    for (const route of forbiddenBrowserMutationRoutes) {
      expect(source).not.toContain(route);
    }
  });

  it('does not add broad mutation clients, hooks/providers/context, feature flag runtime, or API-backed localStorage', () => {
    for (const path of broadMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    for (const [path, source] of srcRuntimeEntries()) {
      if (approvedDataHealthDismissFiles.has(path)) continue;
      if (approvedHistoryDataFlagFiles.has(path)) continue;
      expect(source, `${path} should not add mutation hooks/providers/context`).not.toMatch(/useMutation|MutationProvider|MutationContext|createContext\([^)]*mutation/i);
    }

    const localStorageAdapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(localStorageAdapter).not.toContain('fetch(');
    expect(localStorageAdapter).not.toContain('/history/:id/data-flag');
    expect(localStorageAdapter).not.toContain('/data-health/issues/');
  });

  it('keeps browser-facing source free of Node-only runtime tokens', () => {
    for (const [path, source] of srcRuntimeEntries()) {
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should not include Node-only tokens`).toEqual([]);
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of blockedNodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }
  });

  it('keeps package scripts and dependencies away from history data-flag mutation planning', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = packageJson.scripts || {};
    const allowedScripts = new Set([
      'dev',
      'api:dev:build',
      'api:dev',
      'build',
      'build:stats',
      'build:size-check',
      'predeploy:check',
      'preview',
      'typecheck',
      'test',
      'test:watch',
    ]);
    const blockedScripts = Object.keys(scripts).filter(
      (name) => !allowedScripts.has(name) && /mutation|integration|prod|production|auth|sync/i.test(name),
    );
    expect(blockedScripts).toEqual([]);

    const allDeps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    const blockedDeps = Object.keys(allDeps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    );
    expect(blockedDeps).toEqual([]);
  });

  it('keeps docs from issuing action instructions for history data-flag implementation', () => {
    const docs = [
      'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md',
      'docs/SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md',
      'docs/MUTATION_INTEGRATION_READINESS_AUDIT.md',
      'docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    const blockedInstructions = [
      /(^|\n)\s*(?:[-*]\s*)?implement history data-flag now\b/i,
      /connect POST \/history\/:id\/data-flag to App now/i,
      /enable second mutation route now/i,
      /(^|\n)\s*(?:[-*]\s*)?enable history edit\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable session mutation\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable repair mutation\b/i,
      /(^|\n)\s*(?:[-*]\s*)?replace localStorage\b/i,
      /make API source of truth now/i,
      /deploy production backend/i,
      /(^|\n)\s*(?:[-*]\s*)?enable auth\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable sync\b/i,
    ];

    for (const pattern of blockedInstructions) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
