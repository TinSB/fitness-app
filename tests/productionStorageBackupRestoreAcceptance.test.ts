import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md';

describe('production storage backup restore acceptance', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Storage Backup Restore Acceptance',
      '## Scope / Non-goals',
      '## Backup-first Acceptance',
      '## Restore Verification',
      '## Rollback Drill',
      '## No Real Data Automation',
      '## No Destructive Restore',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers backup-first, restore verification, rollback drill, and safety boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'backup-first',
      'Backup must be created before any write',
      'Restore verification',
      'No fake success',
      'rollback drill',
      'dedicated test environment',
      'no real personal training data',
      'destructive restore',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no backup restore runtime or destructive restore', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not backup runtime implementation.',
      'This is not restore runtime implementation.',
      'This is not destructive restore implementation.',
      'Task 6.17 does not delete localStorage',
      'No rollback runtime is implemented in Task 6.17.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.18', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 6.18 Cloud Sync Model Plan V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
