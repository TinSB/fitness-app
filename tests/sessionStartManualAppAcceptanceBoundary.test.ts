import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Session Start manual App acceptance boundary', () => {
  it('keeps the accepted browser mutation allowlist exactly four routes', () => {
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

  it('keeps runtime source free of forbidden active-session routes and storage writes', () => {
    const source = [
      read('src/devApi/devApiSessionStartClient.ts'),
      read('src/devApi/DevApiSessionStartPrototype.tsx'),
      read('src/devApi/devApiSessionStartConfig.ts'),
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
