import { describe, expect, it } from 'vitest';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md';

describe('History data-flag manual App acceptance docs parity', () => {
  it('keeps the runbook POST allowlist aligned with the Task 4.36 prototype route', () => {
    const doc = readSource(runbookPath);

    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(doc).toContain(`POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`);
    expect(doc.match(/POST \/history\/:id\/data-flag/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('covers every non-accepted browser mutation route as forbidden', () => {
    const doc = readSource(runbookPath);

    for (const forbidden of [
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /history/:id/edit',
      'POST /data-health/repair/apply',
      'backup/import/export/reset/recovery HTTP routes',
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
      'Production-like build',
      'All required flags enabled',
      'stable history record',
      'No stable record',
      'current dataFlag is visible',
      'No POST before explicit confirmation',
      'Cancel prevents POST',
      'Repeated click while pending does not send duplicate POST',
      'No optimistic success appears before response',
      'snapshot metadata',
      'does not show success',
      'LocalStorage Integrity Manual Check',
      'API result does not overwrite AppData or localStorage',
      '`normal` participates in default statistics',
      '`test` remains visible but excluded from default production-like statistics',
      '`excluded` remains visible but excluded from default production-like statistics',
    ]) {
      expect(doc).toContain(phrase);
    }
  });

  it('does not imply production readiness or instruct enabling other mutation routes', () => {
    const doc = readSource(runbookPath);

    for (const pattern of [
      /production ready/i,
      /production-ready/i,
      /enable production/i,
      /enable session mutation/i,
      /enable history edit/i,
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
