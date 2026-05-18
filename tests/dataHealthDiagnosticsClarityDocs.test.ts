import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('data health diagnostics clarity docs', () => {
  const doc = () => readSource('docs/DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md');

  it('records Task 16E identity and Task 16D baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16E',
      'Data Health & Diagnostics Clarity Pack V1',
      'Task 16D complete',
      'PR #259',
      '681d9b57aff08619f5c0d523fb85fa8279015027',
      '1068 files / 4316 tests',
      'dist token scan clean',
      'SaaS remains deferred',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals safety baseline and redaction policy', () => {
    const content = doc();

    for (const expected of [
      'enable automatic repair.',
      'add POST /data-health/repair/apply.',
      'perform destructive repair.',
      'upload external monitoring data.',
      'upload full AppData diagnostic snapshots.',
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'accepted browser mutation routes remain exactly seven.',
      'Diagnostics must require redaction.',
      'Diagnostics must not include full AppData snapshots.',
      'External monitoring upload remains blocked.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents every clarity category and Task 16F recommendation', () => {
    const content = doc();

    for (const expected of [
      'no_issue',
      'informational',
      'review_recommended',
      'backup_recommended',
      'owner_review_required',
      'schema_review_required',
      'recovery_recommended',
      'emergency_local_recommended',
      'cloud_candidate_paused',
      'diagnostics_insufficient',
      'repair_blocked',
      'Task 16F — Mobile / PWA Personal Use Polish Pack V1',
      'Task 16F is recommended but not started by Task 16E.',
      'Task 16E does not start Task 16F.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
