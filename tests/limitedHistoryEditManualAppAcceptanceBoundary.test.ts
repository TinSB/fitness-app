import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
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
  'src/devApi/devApiHistorySetEditClient.ts',
  'src/devApi/devApiHistorySetEditConfig.ts',
  'src/devApi/DevApiHistorySetEditExperiment.tsx',
]);

const blockedRoutes = [
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

const mutationClientPaths = [
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

describe('Limited History Edit manual App acceptance boundaries', () => {
  it('does not require runtime source changes for Task 4.48', () => {
    const mentions = runtimeEntries().filter(([, source]) =>
      /Task 4\.48|LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE|Manual App Acceptance V1/i.test(source),
    );

    expect(mentions.map(([path]) => path)).toEqual([]);
  });

  it('keeps App.tsx, src runtime, and browser-facing API index free of Node-only stack', () => {
    for (const [path, source] of runtimeEntries()) {
      const offenders = nodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${path} should not include Node-only tokens`).toEqual([]);
    }

    const appSource = stripComments(readSource('src/App.tsx'));
    for (const token of nodeOnlyTokens) expect(appSource).not.toContain(token);

    const apiIndex = stripComments(readSource('apps/api/src/index.ts'));
    for (const token of nodeOnlyTokens) expect(apiIndex).not.toContain(token);
  });

  it('keeps browser mutation routes exactly to the accepted three-route set', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
    ]);

    for (const [path, source] of runtimeEntries()) {
      const blocked = blockedRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked browser mutation routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not issue browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
    }
  });

  it('does not add broad mutation clients, browser automation deps, package changes, or API-backed storage', () => {
    for (const path of mutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const localStorageAdapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(localStorageAdapter).not.toContain('fetch(');
    expect(localStorageAdapter).not.toContain('/data-health/issues/');
    expect(localStorageAdapter).not.toContain('/history/:id/data-flag');
    expect(localStorageAdapter).not.toContain('/history/:id/edit');

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
});
