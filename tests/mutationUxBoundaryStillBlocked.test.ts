import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const productionSrcFiles = () =>
  collectSrcRuntimeFiles().filter((path) => {
    const normalized = relativePath(path);
    return !normalized.includes('/__tests__/') && !normalized.endsWith('.test.ts') && !normalized.endsWith('.test.tsx');
  });

const mutationRouteLiterals = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
  '/history/:id/data-flag',
  '/data-health/repair/apply',
];

const approvedDataHealthDismissFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
]);

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

const mutationClientPaths = [
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
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

describe('mutation UX planning keeps write paths blocked', () => {
  it('keeps App.tsx and production browser source free of Node-only imports and mutation route calls', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      const nodeOffenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(nodeOffenders, `${normalized} should not include Node-only tokens`).toEqual([]);

      const routeOffenders = mutationRouteLiterals.filter((route) => source.includes(route));
      expect(routeOffenders, `${normalized} should not call App mutation routes`).toEqual([]);

      if (!approvedDataHealthDismissFiles.has(normalized)) {
        expect(source, `${normalized} should not contain the approved one-route prototype`).not.toContain('/data-health/issues/');
        expect(source, `${normalized} should not issue browser POST requests`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps the frontend read-only client GET-only with no exported mutation methods', () => {
    const source = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const client = createDevApiReadOnlyClient({
      enabled: true,
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    const methodNames = Object.keys(client);
    expect(methodNames).toEqual([
      'readHealth',
      'readAppDataSummary',
      'readSessionsSummary',
      'readHistory',
      'readHistoryDetail',
      'readDataHealthSummary',
    ]);
    expect(methodNames.join(' ')).not.toMatch(/post|put|patch|delete|mutat|start|complete|discard|edit|dismiss|repair/i);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/fetch\s*\([^)]*method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/s);

    for (const route of mutationRouteLiterals) {
      expect(source).not.toContain(route);
    }
  });

  it('does not add frontend mutation clients, mutation feature flag wiring, or API-backed localStorage', () => {
    for (const path of mutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const runtimeSources = productionSrcFiles().map((file) => [relativePath(file), stripComments(readFileSync(file, 'utf8'))] as const);
    const mutationFlagOffenders = runtimeSources.filter(([path, source]) =>
      !approvedDataHealthDismissFiles.has(path)
      && /MUTATION_API|MUTATION_INTEGRATION|VITE_IRONPATH_DEV_API_MUTATION|useMutationApi/i.test(source),
    );
    expect(mutationFlagOffenders.map(([path]) => path)).toEqual([]);

    const localStorageAdapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(localStorageAdapter).not.toContain('fetch(');
    expect(localStorageAdapter).not.toContain('/sessions/start');
    expect(localStorageAdapter).not.toContain('/history/:id/edit');
    expect(localStorageAdapter).not.toContain('/data-health/repair/apply');
  });

  it('keeps browser-facing API exports free of Node-only runtime', () => {
    const apiIndex = readSource('apps/api/src/index.ts');

    for (const token of blockedNodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }
  });

  it('keeps package scripts and dependencies away from mutation UX implementation', () => {
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
    const newBlockedScripts = Object.keys(scripts).filter(
      (name) => !allowedScripts.has(name) && /mutation|integration|prod|production|auth|sync/i.test(name),
    );
    expect(newBlockedScripts).toEqual([]);

    const allDeps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    const blockedDeps = Object.keys(allDeps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    );
    expect(blockedDeps).toEqual([]);
  });

  it('keeps docs from giving action-oriented mutation implementation instructions', () => {
    const docs = [
      'docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md',
      'docs/MUTATION_INTEGRATION_READINESS_AUDIT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/READONLY_APP_MANUAL_ACCEPTANCE.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]
      .map(readSource)
      .join('\n');

    const blockedInstructions = [
      /connect POST routes to App now/i,
      /enable mutation integration now/i,
      /(^|\n)\s*(?:[-*]\s*)?replace localStorage\b/i,
      /make API source of truth now/i,
      /deploy production write backend/i,
      /enable auth/i,
      /enable sync/i,
      /implement mutation prototype now/i,
    ];

    for (const pattern of blockedInstructions) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
