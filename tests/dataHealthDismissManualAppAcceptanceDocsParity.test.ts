import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md';

describe('DataHealth dismiss manual App acceptance docs parity', () => {
  it('keeps the runbook POST allowlist aligned with the prototype route', () => {
    const doc = readSource(runbookPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(doc).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
    expect(doc.match(/POST \/data-health\/issues\/:issueId\/dismiss/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('covers every non-dismiss mutation route as forbidden', () => {
    const doc = readSource(runbookPath);

    for (const forbidden of [
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /history/:id/edit',
      'POST /history/:id/data-flag',
      'POST /data-health/repair/apply',
      'backup/import/export HTTP routes',
      'reset/recovery HTTP routes',
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
      'Production-like build',
      'All required flags enabled',
      'No POST before explicit confirmation',
      'Cancel prevents POST',
      'Repeated click while pending does not send duplicate POST',
      'No optimistic success appears before response',
      'snapshot metadata',
      'does not show success',
      'LocalStorage Integrity Manual Check',
      'API result does not overwrite AppData or localStorage',
    ]) {
      expect(doc).toContain(phrase);
    }
  });

  it('does not imply production readiness or instruct expanded mutation integration', () => {
    const doc = readSource(runbookPath);

    for (const pattern of [
      /production ready/i,
      /enable production/i,
      /enable session mutation/i,
      /enable history mutation/i,
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
