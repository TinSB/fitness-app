import { describe, expect, it } from 'vitest';
import { createInMemoryBackendAppDataRepositoryCandidate } from '../apps/api/src/node/backendAppDataRepositoryCandidate';
import { emptyData } from '../src/storage/persistence';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('backend AppData repository candidate', () => {
  it('is disabled by default and not source-of-truth', () => {
    const repository = createInMemoryBackendAppDataRepositoryCandidate();

    expect(repository).toMatchObject({
      kind: 'backend-appdata-repository-candidate',
      enabled: false,
      sourceOfTruth: false,
      storageModel: 'document-appdata-snapshot',
      normalizedTables: false,
    });
    expect(repository.readLatestAppData()).toMatchObject({
      ok: false,
      error: { code: 'repository_disabled' },
    });
  });

  it('reads latest synthetic AppData without exposing in-place mutation', () => {
    const seed = emptyData();
    const repository = createInMemoryBackendAppDataRepositoryCandidate({ enabled: true, initialData: seed });

    const first = repository.readLatestAppData();
    expect(first).toMatchObject({ ok: true, value: { schemaVersion: seed.schemaVersion } });
    if (!first.ok) throw new Error('expected repository read to pass');
    first.value.history.push({ id: 'mutated-read' } as never);

    const second = repository.readLatestAppData();
    expect(second).toMatchObject({ ok: true });
    if (!second.ok) throw new Error('expected repository read to pass');
    expect(second.value.history).toHaveLength(0);
  });

  it('requires backup before validated candidate write', () => {
    const repository = createInMemoryBackendAppDataRepositoryCandidate({ enabled: true, initialData: emptyData() });
    const nextData = { ...emptyData(), selectedTemplateId: 'candidate-template' };

    expect(repository.writeAppDataCandidate({ data: nextData })).toMatchObject({
      ok: false,
      error: { code: 'backup_required' },
    });

    const backup = repository.createBackupCandidate();
    expect(backup).toMatchObject({ ok: true, value: { sourceOfTruth: false } });
    if (!backup.ok) throw new Error('expected backup to pass');

    expect(repository.writeAppDataCandidate({ data: nextData, backupId: backup.value.backupId })).toMatchObject({
      ok: true,
      value: {
        snapshotId: 'candidate-snapshot-1',
        backupId: backup.value.backupId,
        sourceOfTruth: false,
      },
    });
    nextData.history.push({ id: 'mutated-input' } as never);

    const latest = repository.readLatestAppData();
    expect(latest).toMatchObject({ ok: true });
    if (!latest.ok) throw new Error('expected latest read to pass');
    expect(latest.value.history).toHaveLength(0);
    expect(latest.value.selectedTemplateId).toBe('candidate-template');
  });

  it('returns stable validation and write rejection errors', () => {
    const repository = createInMemoryBackendAppDataRepositoryCandidate({ enabled: true, initialData: emptyData() });
    const backup = repository.createBackupCandidate();
    if (!backup.ok) throw new Error('expected backup to pass');

    expect(repository.validateBeforeWrite({ schemaVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: 'appdata_validation_failed' },
    });
    expect(repository.writeAppDataCandidate({
      data: emptyData(),
      backupId: backup.value.backupId,
      reject: true,
    })).toMatchObject({
      ok: false,
      error: { code: 'write_rejected' },
    });
  });

  it('keeps dev SQLite repository and browser exports separate', () => {
    const source = readSource('apps/api/src/node/backendAppDataRepositoryCandidate.ts');
    const browserApiIndex = readSource('apps/api/src/index.ts');

    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('sqliteRepository');
    expect(browserApiIndex).not.toContain('backendAppDataRepositoryCandidate');
  });

  it('documents Task 9.3 boundaries and next task', () => {
    const doc = readSource('docs/BACKEND_APPDATA_REPOSITORY_CANDIDATE.md');

    for (const expected of [
      'Task 9.3 Backend AppData Repository Candidate V1',
      'document-style AppData snapshot behavior',
      'disabled by default',
      'sourceOfTruth: false',
      'backup id created by `createBackupCandidate()`',
      'repository_disabled',
      'appdata_validation_failed',
      'backup_required',
      'not a normalized production multi-user database',
      'Recommended next task: Task 9.4 Cutover Data Migration Dry Run V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
