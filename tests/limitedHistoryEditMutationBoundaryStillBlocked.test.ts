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

const runtimeEntries = () =>
  collectSrcRuntimeFiles().map((file) => [relativePath(file), stripComments(readFileSync(file, 'utf8'))] as const);

const approvedMutationFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
]);

const blockedBrowserRoutes = [
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

const disallowedClientPaths = [
  'src/devApi/devApiHistoryEditClient.ts',
  'src/devApi/DevApiHistoryEditPrototype.tsx',
  'src/devApi/devApiLimitedHistoryEditClient.ts',
  'src/devApi/DevApiLimitedHistoryEditPrototype.tsx',
  'src/devApi/devApiThirdMutationClient.ts',
  'src/devApi/DevApiThirdMutationPrototype.tsx',
  'src/devApi/devApiMutationClient.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
];

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

describe('limited history edit mutation boundary still blocked', () => {
  it('does not add history edit or other blocked browser mutation calls to App.tsx or src runtime', () => {
    const appSource = stripComments(readSource('src/App.tsx'));
    expect(appSource).not.toContain('/history/:id/edit');
    expect(appSource).not.toMatch(/method\s*:\s*['"`]POST['"`]/);

    for (const [path, source] of runtimeEntries()) {
      const blocked = blockedBrowserRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked browser mutation routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not issue browser POST requests`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps the browser mutation allowlist exactly to the existing two routes', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const [path, source] of runtimeEntries()) {
      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not contain DataHealth dismiss outside approved files`).not.toContain('/data-health/issues/');
        expect(source, `${path} should not contain History data-flag outside approved files`).not.toContain('/history/:id/data-flag');
      }
    }
  });

  it('does not add history edit clients, broad mutation clients, or runtime feature flag wiring', () => {
    for (const path of disallowedClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const allSrc = runtimeEntries().map(([, source]) => source).join('\n');
    expect(allSrc).not.toMatch(/history-edit|limited-history-edit|third-mutation/i);
    expect(allSrc).not.toMatch(/VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT\s*={0,2}\s*['"`](history-edit|limited-history-edit|third-mutation)['"`]/i);
  });

  it('keeps read-only diagnostics GET-only and storage source-of-truth local', () => {
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
    expect(readOnlySource).not.toContain('/history/:id/edit');

    const localStorageAdapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(localStorageAdapter).not.toContain('fetch(');
    expect(localStorageAdapter).not.toContain('/history/:id/edit');
    expect(localStorageAdapter).not.toContain('/history/:id/data-flag');
    expect(localStorageAdapter).not.toContain('/data-health/issues/');
  });

  it('keeps Node-only runtime tokens out of browser source, public API index, package scripts, and dist', () => {
    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should stay browser-safe`).toEqual([]);
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) {
      expect(apiIndex, `apps/api/src/index.ts should not expose ${token}`).not.toContain(token);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts || {});
    expect(scripts.filter((script) => /mutation|integration|prod|production|auth|sync|playwright|cypress/i.test(script))).toEqual([]);

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
