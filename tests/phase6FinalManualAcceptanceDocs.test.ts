import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md';

describe('phase 6 final manual acceptance docs', () => {
  it('documents required final manual acceptance sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Final Manual Acceptance',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Production Readiness Scenario Matrix',
      '## Source-of-truth Checks',
      '## Auth / Account If Implemented',
      '## Sync If Implemented',
      '## Backup / Export / Delete / Recovery',
      '## Deployment If Implemented',
      '## Rollback',
      '## Pass / Fail Template',
      '## Route and CI Boundary',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required manual acceptance scenarios', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Production Readiness Scenario Matrix',
      'Local/dev fallback',
      'source-of-truth',
      'Auth/account',
      'Sync',
      'Backup/export/delete/recovery',
      'Deployment',
      'Rollback',
      'Final result: Pass / Fail',
      'Task 6.39 Phase 6 Exit Regression Lock V1',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
