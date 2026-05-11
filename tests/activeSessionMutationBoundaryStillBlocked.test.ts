import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

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
]);

const blockedBrowserRoutes = [
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

const blockedClientPaths = [
  'src/devApi/devApiSessionMutationClient.ts',
  'src/devApi/DevApiSessionMutationPrototype.tsx',
  'src/devApi/devApiSessionStartClient.ts',
  'src/devApi/DevApiSessionStartPrototype.tsx',
  'src/devApi/devApiSessionPatchClient.ts',
  'src/devApi/DevApiSessionPatchPrototype.tsx',
  'src/devApi/devApiSessionCompleteClient.ts',
  'src/devApi/DevApiSessionCompletePrototype.tsx',
  'src/devApi/devApiSessionDiscardClient.ts',
  'src/devApi/DevApiSessionDiscardPrototype.tsx',
  'src/devApi/devApiMutationClient.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
];

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const runtimeEntries = () =>
  collectSrcRuntimeFiles().map((file) => [relativePath(file), stripComments(readFileSync(file, 'utf8'))] as const);

const collectFilesIfDirectory = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return collectFilesIfDirectory(next);
    return [next];
  });
};

describe('active-session mutation boundary remains blocked', () => {
  it('keeps accepted browser mutation route constants exactly three', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
    ]);
  });

  it('keeps App.tsx and src runtime free of session mutation route calls', () => {
    const appSource = stripComments(readSource('src/App.tsx'));
    for (const route of blockedBrowserRoutes) {
      expect(appSource, `App.tsx should not include ${route}`).not.toContain(route);
    }

    for (const [path, source] of runtimeEntries()) {
      expect(blockedBrowserRoutes.filter((route) => source.includes(route)), `${path} blocked route boundary`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not include DataHealth dismiss route outside approved files`).not.toContain('/data-health/issues/');
        expect(source, `${path} should not include History data-flag route outside approved files`).not.toContain('/history/:id/data-flag');
        expect(source, `${path} should not include Limited History Edit route outside approved files`).not.toContain('/history/:id/edit');
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
    }
  });

  it('keeps read-only client GET-only and permits only read-only sessions summary', () => {
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
    expect(source).toContain('/sessions/summary');
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toContain('/sessions/start');
    expect(source).not.toContain('/sessions/active/patches');
    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toContain('/sessions/active/discard');
  });

  it('does not add session mutation clients, broad mutation clients, Node-only imports, or API-backed storage', () => {
    for (const path of blockedClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should stay browser-safe`).toEqual([]);
      expect(source, `${path} should not add arbitrary mutation helper`).not.toMatch(/\brequest\s*\(\s*method\s*[,):]|\bmutate\s*\(\s*method\s*,\s*path|fetchMutation|mutatePath|postPath/i);
    }

    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/sessions/');
    expect(storage).not.toContain('/history/');
    expect(storage).not.toContain('/data-health/issues/');

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }
  });

  it('keeps package scripts, dependencies, and existing browser build output clean', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts || {});
    expect(scripts.filter((script) => /mutation|integration|prod|production|auth|sync|playwright|cypress/i.test(script))).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);

    const dist = resolve(repoRoot(), 'dist');
    if (!existsSync(dist)) return;
    const files = collectFilesIfDirectory(dist).filter((path) => statSync(path).isFile());
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should not include blocked build tokens`).toEqual([]);
    }
  });
});
