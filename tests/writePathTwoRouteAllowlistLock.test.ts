import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

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

const forbiddenBrowserRoutes = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
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

const broadMutationClientPaths = [
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
  'src/devApi/devApiMutationClient.ts',
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

describe('write-path two-route allowlist lock', () => {
  it('keeps browser mutation routes exactly DataHealth dismiss and History data-flag', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const [path, source] of runtimeEntries()) {
      const blocked = forbiddenBrowserRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked mutation routes`).toEqual([]);

      if (!approvedDataHealthDismissFiles.has(path)) {
        expect(source, `${path} should not include DataHealth dismiss route`).not.toContain('/data-health/issues/');
      }
      if (!approvedHistoryDataFlagFiles.has(path)) {
        expect(source, `${path} should not include History data-flag route`).not.toContain('/history/:id/data-flag');
        expect(source, `${path} should not include dynamic History data-flag route`).not.toMatch(/\/history\/\$\{[^}]+}\/*data-flag/);
      }
      if (!approvedDataHealthDismissFiles.has(path) && !approvedHistoryDataFlagFiles.has(path)) {
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
      expect(source, `${path} should not add arbitrary mutation helper`).not.toMatch(/\brequest\s*\(\s*method\s*[,):]|\bmutate\s*\(\s*method\s*,\s*path|fetchMutation|mutatePath|postPath/i);
    }
  });

  it('keeps read-only client GET-only and separate from mutation prototypes', () => {
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
    expect(source).not.toContain('/history/:id/data-flag');
    expect(source).not.toContain('/data-health/issues/:issueId/dismiss');
  });

  it('blocks Node-only browser imports, broad mutation clients, package changes, and API-backed storage', () => {
    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should stay browser-safe`).toEqual([]);
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) expect(apiIndex).not.toContain(token);

    for (const path of broadMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const adapter = readSource('src/storage/localStorageAdapter.ts');
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/history/:id/data-flag');
    expect(adapter).not.toContain('/data-health/issues/');

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
  });

  it('keeps existing browser build output free of Node-only tokens when dist is present', () => {
    const dist = resolve(repoRoot(), 'dist');
    if (!existsSync(dist)) {
      expect(true).toBe(true);
      return;
    }

    const files = collectFilesIfDirectory(dist).filter((path) => statSync(path).isFile());
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should not include Node-only build tokens`).toEqual([]);
    }
  });
});
