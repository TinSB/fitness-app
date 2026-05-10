import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import {
  collectSrcRuntimeFiles,
  readSource,
  relativePath,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const productionSrcFiles = () =>
  collectSrcRuntimeFiles().filter((path) => {
    const normalized = relativePath(path);
    return !normalized.includes('/__tests__/') && !normalized.endsWith('.test.ts') && !normalized.endsWith('.test.tsx');
  });

const approvedDismissFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
]);

const blockedRoutes = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
  '/history/:id/data-flag',
  '/data-health/repair/apply',
  '/backup/',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const nodeOnlyTokens = [
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

describe('DataHealth dismiss acceptance boundaries', () => {
  it('keeps production browser source free of Node-only stack tokens', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${normalized} should not include Node-only stack tokens`).toEqual([]);
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) expect(apiIndex).not.toContain(token);
  });

  it('exposes only the single approved DataHealth dismiss browser mutation route', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      const blocked = blockedRoutes.filter((route) => source.includes(route));
      expect(blocked, `${normalized} should not include blocked mutation/write routes`).toEqual([]);

      if (!approvedDismissFiles.has(normalized)) {
        expect(source, `${normalized} should not contain the approved dismiss route`).not.toContain('/data-health/issues/');
        expect(source, `${normalized} should not use browser POST`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps the read-only client GET-only', () => {
    const source = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const client = createDevApiReadOnlyClient({
      enabled: true,
      status: 'enabled',
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
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toContain('/data-health/issues/');
  });

  it('does not add a broad mutation client, API-backed storage, package script, or dependency', () => {
    for (const path of mutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/data-health/issues/');

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts || {});
    expect(scripts.filter((script) => /mutation|integration|prod|production|auth|sync/i.test(script))).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);
  });

  it('keeps docs from authorizing expanded mutation integration', () => {
    const docs = [
      'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
      'docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md',
      'docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md',
      'docs/MUTATION_INTEGRATION_READINESS_AUDIT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].filter(existsSync).map(readSource).join('\n');

    for (const pattern of [
      /connect POST routes to App now/i,
      /enable other mutation routes/i,
      /enable session mutation/i,
      /enable history mutation/i,
      /enable DataHealth repair mutation/i,
      /make API source of truth now/i,
      /deploy production write backend/i,
      /enable auth/i,
      /enable sync/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
