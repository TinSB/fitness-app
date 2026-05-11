import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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

describe('active-session source snapshot boundary remains constrained', () => {
  it('keeps the browser mutation allowlist at four routes after Task 4.60', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
    ]);
  });

  it('keeps active patch, complete, and discard out of browser runtime source', () => {
    const blocked = [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ];

    for (const [path, source] of runtimeEntries()) {
      expect(blocked.filter((route) => source.includes(route)), `${path} blocked route boundary`).toEqual([]);
    }
  });

  it('allows only the session-start prototype and blocks broad mutation clients or API-backed storage', () => {
    for (const path of [
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/devApiSessionStartConfig.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
    ]) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should exist`).not.toEqual([]);
    }

    for (const path of [
      'src/devApi/devApiSessionMutationClient.ts',
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
    ]) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/sessions/');
  });

  it('keeps package scripts, dependencies, and existing dist output clean', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /mutation|integration|prod|auth|sync|playwright|cypress/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((dep) => /auth|sync|mutation-client|playwright|cypress/i.test(dep))).toEqual([]);

    const tokens = ['node:http', 'node:sqlite', 'devLauncher', 'httpRuntimeAdapter', 'serverAdapter', 'sqliteRepository', 'devApiRunner', 'devDbRecovery'];
    const dist = resolve(repoRoot(), 'dist');
    if (!existsSync(dist)) return;
    const files = collectFilesIfDirectory(dist).filter((file) => statSync(file).isFile());
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(tokens.filter((token) => source.includes(token)), `${relativePath(file)} build boundary`).toEqual([]);
    }
  });
});
