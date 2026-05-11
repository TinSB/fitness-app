import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Session Start acceptance boundary', () => {
  it('keeps the browser mutation route allowlist exactly four routes', () => {
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

  it('keeps active patch, complete, discard, repair, backup, reset, and recovery blocked from the browser prototype', () => {
    const source = [
      readSource('src/devApi/devApiSessionStartClient.ts'),
      readSource('src/devApi/DevApiSessionStartPrototype.tsx'),
      readSource('src/devApi/devApiSessionStartConfig.ts'),
    ].join('\n');

    [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'saveData',
      'loadData',
      'localStorageAdapter',
      'node:http',
      'node:sqlite',
    ].forEach((blocked) => expect(source).not.toContain(blocked));
  });
});
