import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md';

describe('production rollback incident runbook', () => {
  it('documents required rollback and incident sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Rollback Incident Runbook',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Incident Detection',
      '## Data Safety',
      '## Restore Verification',
      '## Privacy Incident Handling',
      '## Rollback Procedure Template',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers rollback, incident detection, data safety, restore verification, and privacy incident handling', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'rollback',
      'incident detection',
      'data safety',
      'restore verification',
      'privacy incident handling',
      'No restore runtime is implemented in Task 6.27.',
      'No real personal training data may be used in automated tasks.',
      'Task 6.28 Production Data Export / Delete Plan V1',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('states no runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not runtime incident handling implementation.',
      'Task 6.27 adds no incident detector',
      'No destructive operation is performed by this task.',
      'Logs must not include raw AppData',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
