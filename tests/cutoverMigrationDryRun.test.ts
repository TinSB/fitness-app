import { describe, expect, it } from 'vitest';
import { runCutoverMigrationDryRun } from '../src/productionCutover/cutoverMigrationDryRun';
import { emptyData } from '../src/storage/persistence';
import { readSource } from './runtimeBoundaryTestHelpers';

const readyRepository = {
  enabled: true,
  backupCandidateAvailable: true,
  writesSupported: true,
};

describe('cutover migration dry run', () => {
  it('reports valid AppData as safe without changing source-of-truth', () => {
    const data = emptyData();
    const before = JSON.stringify(data);

    expect(runCutoverMigrationDryRun({ data, repository: readyRepository })).toMatchObject({
      ok: true,
      safeToCutover: true,
      blockingErrors: [],
      summary: {
        schemaVersion: data.schemaVersion,
        historyCount: 0,
        hasActiveSession: false,
        backendRepositoryEnabled: true,
        backendWritesSupported: true,
      },
      backupRequired: true,
      sourceOfTruthChanged: false,
      localStorageMutated: false,
    });
    expect(JSON.stringify(data)).toBe(before);
  });

  it('reports legacy or partial data requiring sanitize as warning-only when valid after sanitize', () => {
    const result = runCutoverMigrationDryRun({
      data: { schemaVersion: 1 },
      repository: readyRepository,
    });

    expect(result.safeToCutover).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain('appdata_required_sanitize_or_migration');
  });

  it('blocks invalid schema, missing backup readiness, and backend unavailable', () => {
    const result = runCutoverMigrationDryRun({
      data: 'not-appdata',
      repository: {
        enabled: false,
        backupCandidateAvailable: false,
        writesSupported: false,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      safeToCutover: false,
      sourceOfTruthChanged: false,
      localStorageMutated: false,
    });
    expect(result.blockingErrors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'invalid_appdata_schema',
      'backend_repository_unavailable',
      'backend_repository_write_unavailable',
      'backup_not_ready',
    ]));
  });

  it('reports active session as warning without blocking cutover readiness', () => {
    const data = {
      ...emptyData(),
      activeSession: {
        id: 'synthetic-active-session',
        templateId: 'synthetic-template',
        templateName: 'Synthetic Template',
        startedAt: '2026-05-13T00:00:00.000Z',
        completedAt: null,
        exercises: [],
      },
    };

    const result = runCutoverMigrationDryRun({ data, repository: readyRepository });

    expect(result.safeToCutover).toBe(true);
    expect(result.summary.hasActiveSession).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain('active_session_present');
  });

  it('documents dry-run safety and next task', () => {
    const doc = readSource('docs/CUTOVER_DATA_MIGRATION_DRY_RUN.md');

    for (const expected of [
      'Task 9.4 Cutover Data Migration Dry Run V1',
      'diagnostic readiness reporting only',
      'sourceOfTruthChanged: false',
      'localStorageMutated: false',
      'never mutates input AppData in place',
      'never writes backend data as source-of-truth',
      'Recommended next task: Task 9.5 Backend-Primary Read Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
