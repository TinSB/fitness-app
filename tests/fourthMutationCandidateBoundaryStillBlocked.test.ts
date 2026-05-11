import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
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
]);

const blockedBrowserRoutes = [
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

const fourthMutationClientPaths = [
  'src/devApi/devApiFourthMutationClient.ts',
  'src/devApi/DevApiFourthMutationPrototype.tsx',
  'src/devApi/devApiSessionMutationClient.ts',
  'src/devApi/DevApiSessionMutationPrototype.tsx',
  'src/devApi/devApiSessionDiscardClient.ts',
  'src/devApi/DevApiSessionDiscardPrototype.tsx',
  'src/devApi/devApiDataHealthRepairClient.ts',
  'src/devApi/DevApiDataHealthRepairPrototype.tsx',
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

describe('fourth mutation candidate boundary still blocked', () => {
  it('keeps App.tsx and src runtime from calling session, repair, backup, reset, or recovery mutation routes', () => {
    const appSource = stripComments(readSource('src/App.tsx'));
    expect(appSource).not.toContain('/sessions/active/discard');

    for (const [path, source] of runtimeEntries()) {
      const blocked = blockedBrowserRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked browser mutation routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not include DataHealth dismiss route outside approved files`).not.toContain('/data-health/issues/');
        expect(source, `${path} should not include History data-flag route outside approved files`).not.toContain('/history/:id/data-flag');
        expect(source, `${path} should not include Limited History Edit route outside approved files`).not.toContain('/history/:id/edit');
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
      expect(source, `${path} should not add arbitrary mutation helper`).not.toMatch(/\brequest\s*\(\s*method\s*[,):]|\bmutate\s*\(\s*method\s*,\s*path|fetchMutation|mutatePath|postPath/i);
    }
  });

  it('keeps the browser mutation allowlist exactly to the six accepted routes after Task 5.17', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
      `POST ${DEV_API_SESSION_COMPLETE_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
    ]);
  });

  it('does not add broad mutation clients or next active-session feature flag runtime wiring', () => {
    for (const path of fourthMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const allSrc = runtimeEntries().map(([, source]) => source).join('\n');
    expect(allSrc).not.toMatch(/fourth-mutation|datahealth-repair/i);
    expect(allSrc).not.toMatch(/VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT\s*={0,2}\s*['"`](fourth-mutation|session-mutation|session-discard|datahealth-repair)['"`]/i);
  });

  it('keeps the read-only client GET-only and separate from mutation routes', () => {
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
    expect(source).not.toContain('/sessions/start');
    expect(source).not.toContain('/sessions/active/patches');
    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toContain('/sessions/active/discard');
    expect(source).not.toContain('/history/:id/edit');
    expect(source).not.toContain('/history/:id/data-flag');
    expect(source).not.toContain('/data-health/issues/:issueId/dismiss');
  });

  it('keeps Node-only runtime tokens out of browser source and apps/api public index', () => {
    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should stay browser-safe`).toEqual([]);
    }

    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of nodeOnlyTokens) {
      expect(apiIndex, `apps/api/src/index.ts should not expose ${token}`).not.toContain(token);
    }
  });

  it('keeps package scripts, API-backed storage, and browser build output clean', () => {
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

    const localStorageAdapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(localStorageAdapter).not.toContain('fetch(');
    expect(localStorageAdapter).not.toContain('/sessions/');
    expect(localStorageAdapter).not.toContain('/history/');
    expect(localStorageAdapter).not.toContain('/data-health/issues/');

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
