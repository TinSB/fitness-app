import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md';

describe('production manual acceptance runbook', () => {
  it('documents required runbook sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Manual Acceptance Runbook',
      '## Scope / Non-goals',
      '## Dedicated Test Environment',
      '## Phase 6 Baseline',
      '## Source-of-truth Checks',
      '## Auth / Account Checks',
      '## Sync Checks',
      '## Backup / Export / Delete / Recovery Checks',
      '## Deployment Checks',
      '## Rollback Checks',
      '## Pass / Fail Template',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('requires dedicated test environment and synthetic data', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'dedicated test environment',
      'dedicated browser profile',
      'dedicated dev DB',
      'synthetic data',
      'No real personal training data may be used unless a future explicit approval defines controlled handling',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers source-of-truth, auth, sync, backup/export/delete/recovery, deployment, rollback, and pass/fail', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage remains default runtime source',
      'api-primary-dev remains explicit dev/local only',
      'record `not implemented` and do not attempt login/signup',
      'record `not implemented` and do not attempt cloud writes',
      'backup-first policy',
      'export/delete responsibilities',
      'record `not implemented` and do not deploy production',
      'rollback owner',
      'Final result: Pass / Fail',
      'Task 6.27 Production Rollback & Incident Runbook V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
