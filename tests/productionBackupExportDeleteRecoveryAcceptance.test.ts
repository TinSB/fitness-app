import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md';

describe('production backup export delete recovery acceptance', () => {
  it('documents required acceptance sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Backup Export Delete Recovery Acceptance',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Export Policy Acceptance',
      '## Delete Policy Acceptance',
      '## Account Deletion Implications',
      '## Backup-first Rule',
      '## Restore Verification',
      '## Rollback Drill',
      '## No Destructive Automated Real-data Operation',
      '## No Silent Overwrite',
      '## Route Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required backup export delete recovery safety rules', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'export',
      'delete',
      'account deletion implications if accounts exist',
      'backup-first',
      'Restore verification must fail visibly. No fake success is allowed.',
      'rollback drill',
      'no real personal training data',
      'No silent overwrite',
      'Task 6.34 Production Sync / Conflict Final Audit V1',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('states no runtime or destructive automated operation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not backup runtime implementation.',
      'This is not export runtime implementation.',
      'This is not delete runtime implementation.',
      'This is not recovery runtime implementation.',
      'Task 6.33 performs no rollback runtime operation.',
      'No backup/import/export over HTTP is added by Task 6.33.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
