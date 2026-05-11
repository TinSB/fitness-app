import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md';

describe('migration backup and rollback strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Backup-first Rule',
      '## localStorage Backup Strategy',
      '## SQLite Snapshot Backup Strategy',
      '## Dry-run Strategy',
      '## Apply Strategy',
      '## Rollback to localStorage Strategy',
      '## Corrupt Snapshot Handling',
      '## Schema Mismatch Handling',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers backup-first localStorage and SQLite snapshot rules', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Every future migration apply must be backup-first.',
      'localStorage backup must be created before any SQLite write.',
      'SQLite snapshot backup must be created before replacing or superseding any dev DB snapshot.',
      'Backup validation must run before apply.',
      'Backup artifacts must not be committed.',
      'full raw localStorage AppData payload',
      'checksum or hash',
      'pre-apply snapshot',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers dry-run, apply, rollback, corrupt snapshot, and schema mismatch', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Future dry-run must be read-only.',
      'Produce no writes.',
      'Future apply must be dev-only and explicit-confirmation only.',
      'Do not delete localStorage.',
      'Do not auto-switch runtime source.',
      'Rollback must restore App usability from localStorage.',
      'If a localStorage backup or SQLite snapshot is corrupt:',
      'If schema validation or repository schema checks fail:',
      'block migration apply.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and recommends Task 5.6', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This does not implement migration dry-run.',
      'This does not implement migration apply.',
      'This does not write SQLite snapshots.',
      'Task 5.6 Offline / PWA Conflict Strategy V1',
      'Task 5.6 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

