import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md';

describe('Phase 5 final manual acceptance docs', () => {
  it('contains the required manual acceptance sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 5 Final Manual Acceptance',
      '## Scope / Non-goals',
      '## Required Test Environment',
      '## Startup Commands',
      '## Runtime Source Matrix',
      '## API Primary Boot Acceptance',
      '## Full Workout Flow Acceptance',
      '## History Edit Acceptance',
      '## Data Flag Acceptance',
      '## Data Health Dismiss Acceptance',
      '## Migration Apply Acceptance',
      '## Migration Rollback Acceptance',
      '## API Unavailable Acceptance',
      '## Network Route Boundary',
      '## Cleanup / Env Reset',
      '## Manual Pass / Fail Template',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required manual flows and safety inputs', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data',
      'API Primary Boot Acceptance',
      'Full Workout Flow Acceptance',
      'History Edit Acceptance',
      'Data Health Dismiss Acceptance',
      'Migration Apply Acceptance',
      'Migration Rollback Acceptance',
      'API Unavailable Acceptance',
      'localStorage is not deleted',
      'source is not auto-switched',
      'Task 5.39 Phase 5 Exit Regression Lock V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks accepted and forbidden browser routes in the runbook', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'any eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
