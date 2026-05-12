import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_DATA_EXPORT_DELETE_PLAN.md';

describe('production data export delete plan', () => {
  it('documents required plan sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Data Export Delete Plan',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Export Responsibilities',
      '## Delete Responsibilities',
      '## Account Deletion',
      '## Backup Retention',
      '## Audit Record Retention',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers export, delete, account deletion, backup retention, and audit record retention', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'export',
      'delete',
      'account deletion',
      'backup retention',
      'audit record retention',
      'no export runtime',
      'no delete runtime',
      'no implementation',
      'Task 6.29 Production Phase Implementation Boundary Lock V1',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
