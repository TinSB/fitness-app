import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md';

describe('production migration backup rollback strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Migration Backup Rollback Strategy',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Backup-first Rule',
      '## Dry-run Strategy',
      '## Apply Strategy',
      '## Rollback Strategy',
      '## Recovery Drill',
      '## Export / Delete Implications',
      '## Real Data Safety',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required migration, backup, rollback, and recovery topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'backup-first',
      'verified backup',
      'dry-run',
      'apply',
      'rollback',
      'recovery drill',
      'export/delete',
      'no destructive migration',
      'no real personal training data',
      'no real-data automation',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no migration or backup runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not migration implementation.',
      'This is not destructive migration implementation.',
      'This is not production source-of-truth migration implementation.',
      'No backup runtime',
      'Task 6.7 does not implement migration apply',
      'No recovery runtime',
      'do not implement migration runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.8', () => {
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
      'Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1',
      'Task 6.8 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
