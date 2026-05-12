import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
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
  'src/devApi/devApiSessionStartClient.ts',
  'src/devApi/devApiSessionStartConfig.ts',
  'src/devApi/DevApiSessionStartPrototype.tsx',
  'src/devApi/devApiSessionPatchClient.ts',
  'src/devApi/devApiSessionPatchConfig.ts',
  'src/devApi/DevApiSessionPatchPrototype.tsx',
  'src/devApi/devApiSessionCompleteClient.ts',
  'src/devApi/devApiSessionCompleteConfig.ts',
  'src/devApi/DevApiSessionCompletePrototype.tsx',
  'src/devApi/devApiSessionDiscardClient.ts',
  'src/devApi/devApiSessionDiscardConfig.ts',
  'src/devApi/DevApiSessionDiscardPrototype.tsx',
]);

const forbiddenBrowserRoutes = [
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

describe('active session full write-path boundary lock', () => {
  it('keeps browser mutation routes exactly the seven accepted prototypes', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
      `POST ${DEV_API_SESSION_COMPLETE_ROUTE}`,
      `POST ${DEV_API_SESSION_DISCARD_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]);
  });

  it('blocks repair, backup, reset, recovery, arbitrary writes, and broad mutation clients', () => {
    for (const [path, source] of runtimeEntries()) {
      const blocked = forbiddenBrowserRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked mutation routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
      expect(source, `${path} should not add arbitrary mutation helper`).not.toMatch(/\brequest\s*\(\s*method\s*[,):]|\bmutate\s*\(\s*method\s*,\s*path|fetchMutation|mutatePath|postPath/i);
    }

    for (const path of broadMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
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
    expect(source).not.toContain('/history/:id/edit');
    expect(source).not.toContain('/data-health/issues/:issueId/dismiss');
    expect(source).not.toContain('/sessions/start');
    expect(source).not.toContain('/sessions/active/patches');
    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toContain('/sessions/active/discard');
  });

  it('keeps Node-only browser imports, package drift, and API-backed storage blocked', () => {
    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should stay browser-safe`).toEqual([]);
      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not add mutation hooks/providers/context`).not.toMatch(/useMutation|MutationProvider|MutationContext|createContext\([^)]*mutation/i);
      }
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }

    const adapter = readSource('src/storage/localStorageAdapter.ts');
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/history/');
    expect(adapter).not.toContain('/data-health/issues/');
    expect(adapter).not.toContain('/sessions/');
    expect(adapter).not.toContain('DevApiSession');

    const packageJson = readSource('package.json');
    expect(packageJson).not.toMatch(/playwright|cypress|mutation-client|auth|sync|cloud/i);
  });
});
