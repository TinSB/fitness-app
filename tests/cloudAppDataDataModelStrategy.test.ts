import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud AppData data model strategy', () => {
  it('chooses document-first AppData snapshot model', () => {
    const doc = readSource('docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md');

    for (const expected of [
      'document-first AppData cloud snapshot model',
      'cloud_appdata_snapshots',
      'validated AppData document/snapshot',
      'Preserve backup and rollback semantics.',
      'Keep normalized training tables blocked.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines required snapshot metadata', () => {
    const doc = readSource('docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md');

    for (const expected of [
      'snapshotId',
      'accountId',
      'ownerUserId',
      'sourceSnapshotHash',
      'schemaVersion',
      'createdAt',
      'operationId',
      'validationStatus',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('blocks normalized tables destructive migration and partial cloud table migration', () => {
    const doc = readSource('docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md');

    for (const expected of [
      'Normalized exercise tables are blocked.',
      'Normalized session tables are blocked.',
      'Normalized history tables are blocked.',
      'Normalized set tables are blocked.',
      'Destructive migration is blocked.',
      'Partial cloud table migration is blocked.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('confirms no schema repository package or runtime implementation', () => {
    const doc = readSource('docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md');
    const packageJson = JSON.parse(readSource('package.json')) as { dependencies: Record<string, string> };

    expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    expect(doc).toContain('No actual database table is created.');
    expect(doc).toContain('No SQL migration is added or applied.');
    expect(doc).toContain('No cloud repository is implemented in this task.');
    expect(doc).toContain('No package dependency, script, or lockfile change is made.');
  });

  it('recommends Task 12.5 only', () => {
    const doc = readSource('docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md');

    expect(doc).toContain('Recommended next task: Task 12.5 Cloud RLS / Ownership Policy Plan V1.');
  });
});
