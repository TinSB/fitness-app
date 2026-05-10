import { describe, expect, it } from 'vitest';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md';

describe('Limited History Edit manual App acceptance docs parity', () => {
  it('keeps the runbook POST allowlist aligned with the Task 4.46 prototype route', () => {
    const doc = readSource(runbookPath);

    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(doc).toContain(`POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`);
    expect(doc.match(/POST \/history\/:id\/edit/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('covers every non-accepted browser mutation route as forbidden', () => {
    const doc = readSource(runbookPath);

    for (const forbidden of [
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export/reset/recovery HTTP route',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('documents the required manual acceptance scenarios', () => {
    const doc = readSource(runbookPath);

    for (const phrase of [
      'Compare flag off',
      'Mutation flag off',
      'Compare flag on only',
      'Mutation flag on only',
      'datahealth-dismiss',
      'history-data-flag',
      'Production-like build',
      'All required flags enabled',
      'No stable session/exercise/set',
      'No POST before explicit confirmation',
      'Cancel prevents POST',
      'Repeated click while pending sends at most one request',
      'No optimistic success appears before response',
      'Snapshot metadata exists',
      'does not show success',
      'LocalStorage Integrity Manual Check',
      'API result is not merged into AppData',
      '`actualWeightKg` remains trusted',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`',
    ]) {
      expect(doc).toContain(phrase);
    }
  });

  it('does not imply production readiness or instructing other mutation routes', () => {
    const doc = readSource(runbookPath);

    for (const pattern of [
      /production ready/i,
      /production-ready/i,
      /enable production/i,
      /enable session mutation/i,
      /enable repair mutation/i,
      /enable other mutation routes/i,
      /replace localStorage/i,
      /make API source of truth/i,
      /enable auth/i,
      /enable sync/i,
    ]) {
      expect(doc).not.toMatch(pattern);
    }
  });
});
