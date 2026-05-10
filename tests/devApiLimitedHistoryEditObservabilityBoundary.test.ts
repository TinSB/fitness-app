import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('limited history edit observability boundary', () => {
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

  it('does not add browser recovery actions, fourth routes, or Node-only tokens', () => {
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

    const prototype = stripComments(readSource('src/devApi/DevApiHistorySetEditExperiment.tsx'));
    expect(prototype).not.toMatch(/>\s*(Repair|Sync|Overwrite|Import|Export|Reset|Apply|Fix)\s*</i);
    expect(readSource('src/storage/localStorageAdapter.ts')).not.toContain('fetch(');
  });

  it('keeps read-only comparison separate and GET-only', () => {
    const readOnlySource = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const readOnlyClient = createDevApiReadOnlyClient({
      enabled: true,
      status: 'enabled',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    expect(Object.keys(readOnlyClient)).toEqual([
      'readHealth',
      'readAppDataSummary',
      'readSessionsSummary',
      'readHistory',
      'readHistoryDetail',
      'readDataHealthSummary',
    ]);
    expect(readOnlySource).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(readOnlySource).not.toContain('/history/:id/edit');
  });
});
