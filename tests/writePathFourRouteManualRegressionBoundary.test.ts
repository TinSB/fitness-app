import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('write-path four-route manual regression boundary', () => {
  it('keeps manual network boundary to the four accepted POST routes', () => {
    const doc = readSource('docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md');

    expect(doc).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
    expect(doc).toContain(`POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`);
    expect(doc).toContain(`POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`);
    expect(doc).toContain(`POST ${DEV_API_SESSION_START_ROUTE}`);
    expect(doc).toContain('`POST /sessions/active/patches`');
    expect(doc).toContain('`POST /sessions/active/complete`');
    expect(doc).toContain('`POST /sessions/active/discard`');
    expect(doc).toContain('`POST /data-health/repair/apply`');
    expect(doc).toContain('backup/import/export/reset/recovery HTTP routes');
    expect(doc).not.toMatch(/POST \/sessions\/active\/.*Accepted/i);
    expect(doc).not.toMatch(/repair.*Accepted/i);
  });

  it('keeps manual recovery and cleanup outside browser mutation behavior', () => {
    const doc = readSource('docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md');

    for (const expected of [
      'Stop Dev API runner',
      'Verify no localStorage writes',
      'Verify no fake success',
      'Restart runner and verify App can recover after refresh/retry',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue',
      'Do not commit dev DB artifacts.',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/browser reset action/i);
    expect(doc).not.toMatch(/HTTP recovery endpoint/i);
  });
});
