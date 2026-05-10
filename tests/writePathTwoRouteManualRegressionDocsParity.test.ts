import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md';

describe('write-path two-route manual regression docs parity', () => {
  it('keeps allowed POST routes aligned with the current accepted mutation allowlist', () => {
    const doc = readSource(runbookPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(doc).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
    expect(doc).toContain(`POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`);

    const allowedPostMatches = [...doc.matchAll(/`POST ([^`]+)`/g)].map((match) => match[1]);
    const accepted = new Set(allowedPostMatches.filter((route) =>
      route === DEV_API_DATA_HEALTH_DISMISS_ROUTE || route === DEV_API_HISTORY_DATA_FLAG_ROUTE,
    ));
    expect([...accepted].sort()).toEqual([
      DEV_API_DATA_HEALTH_DISMISS_ROUTE,
      DEV_API_HISTORY_DATA_FLAG_ROUTE,
    ].sort());
  });

  it('lists all forbidden mutation route families and both existing manual runbooks', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      '`POST /sessions/start`',
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      '`POST /history/:id/edit`',
      '`POST /data-health/repair/apply`',
      'backup/import/export/reset/recovery HTTP routes',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks mutation experiment isolation wording', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'datahealth-dismiss',
      'history-data-flag',
      'DataHealth dismiss flag enables only its own prototype',
      'History data-flag flag enables only its own prototype',
      'Read-only compare flag alone: read-only diagnostics only',
      'History data-flag prototype must not appear solely because `datahealth-dismiss` flag is enabled',
      'DataHealth dismiss prototype must not appear solely because `history-data-flag` flag is enabled',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not suggest production readiness or enabling a third mutation route', () => {
    const docs = [
      runbookPath,
      'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /Task 4\.41[^.\n]*(production ready|production-ready)/i,
      /two-route manual regression[^.\n]*(production ready|production-ready)/i,
      /enable third mutation/i,
      /add third mutation/i,
      /enable session mutation/i,
      /enable history edit/i,
      /enable repair mutation/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /enable auth/i,
      /enable sync/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
