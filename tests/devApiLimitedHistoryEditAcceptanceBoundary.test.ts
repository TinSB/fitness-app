import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('limited history edit acceptance route and source boundary', () => {
  it('keeps accepted browser mutation routes exactly three', () => {
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

  it('keeps forbidden browser mutation route strings out of src runtime', () => {
    const forbidden = [
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

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const path = relativePath(file);
      expect(forbidden.filter((route) => source.includes(route)), `${path} should not expose forbidden routes`).toEqual([]);
    }
  });

  it('keeps source-of-truth and package boundaries locked', () => {
    const storage = readSource('src/storage/localStorageAdapter.ts');
    const client = readSource('src/devApi/devApiHistorySetEditClient.ts');
    const prototype = readSource('src/devApi/DevApiHistorySetEditExperiment.tsx');
    const packageJson = readSource('package.json');

    expect(storage).not.toContain('fetch(');
    expect(client).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
    expect(prototype).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
    expect(packageJson).not.toMatch(/fastify|express|koa|hono|trpc|graphql|mutation-client|playwright|cypress/i);
  });
});
