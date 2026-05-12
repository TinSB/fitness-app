import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md';

describe('production storage schema strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Storage Schema Strategy',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Snapshot Repository Strategy',
      '## Normalized Schema Future Risk',
      '## Migration Strategy',
      '## Rollback Strategy',
      '## Backup Strategy',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers snapshot repository, normalized risk, migration, rollback, and backup', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'snapshot repository',
      'normalized schema',
      'migration risk',
      'rollback',
      'backup',
      'no normalized schema',
      'no normalized tables',
      'no schema implementation',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no schema or migration implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not schema implementation.',
      'This is not normalized table implementation.',
      'This is not production database migration implementation.',
      'Task 6.15 does not implement migration dry-run',
      'No rollback runtime is implemented in Task 6.15.',
      'Task 6.15 adds no backup runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.16', () => {
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
      'Task 6.16 Production Storage Migration Dry-run Prototype V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
