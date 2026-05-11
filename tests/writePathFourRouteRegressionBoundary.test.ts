import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('write-path four-route regression boundary', () => {
  it('keeps browser mutation route constants exactly four', () => {
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

  it('keeps active follow-up routes, recovery routes, and Node-only tokens out of browser source', () => {
    const forbidden = [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('does not add broad mutation clients, API-backed storage, or package expansion', () => {
    for (const path of [
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
      'src/api/mutations',
      'src/devApi/devApiMutationClient.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/sessions/start');
    expect(storage).not.toContain('/history/');

    const packageJson = readSource('package.json');
    expect(packageJson).not.toMatch(/fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i);
  });
});
