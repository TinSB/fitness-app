import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const approvedMutationFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
  'src/devApi/devApiHistorySetEditClient.ts',
  'src/devApi/devApiHistorySetEditConfig.ts',
  'src/devApi/DevApiHistorySetEditExperiment.tsx',
  'src/devApi/devApiSessionStartClient.ts',
  'src/devApi/devApiSessionStartConfig.ts',
  'src/devApi/DevApiSessionStartPrototype.tsx',
  'src/devApi/devApiSessionPatchClient.ts',
  'src/devApi/devApiSessionPatchConfig.ts',
  'src/devApi/DevApiSessionPatchPrototype.tsx',
]);

const blockedBrowserMutationRoutes = [
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

describe('Dev API session patch boundary', () => {
  it('locks accepted browser mutation routes to exactly five route constants', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
    ]);
  });

  it('keeps browser source free of blocked routes and broad write methods', () => {
    for (const [path, source] of srcRuntimeEntries()) {
      const routeOffenders = blockedBrowserMutationRoutes.filter((route) => source.includes(route));
      expect(routeOffenders, `${path} should not contain blocked mutation routes`).toEqual([]);
      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not use browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
    }
  });

  it('keeps browser source free of Node-only imports and keeps read-only client GET-only', () => {
    for (const [path, source] of srcRuntimeEntries()) {
      const nodeOffenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(nodeOffenders, `${path} should not include Node-only tokens`).toEqual([]);
    }
    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of blockedNodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }

    const readOnlySource = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
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
    expect(readOnlySource).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
  });

  it('does not add broad mutation client, package drift, or API-backed storage', () => {
    for (const path of broadMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
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
    expect(Object.keys(packageJson.scripts || {}).filter((name) => !allowedScripts.has(name))).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);

    const storage = readSource('src/storage/localStorageAdapter.ts') + readSource('src/storage/persistence.ts');
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/sessions/');
  });
});
