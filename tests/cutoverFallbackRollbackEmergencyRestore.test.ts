import { describe, expect, it } from 'vitest';
import { evaluateCutoverFallbackRollback } from '../src/productionCutover/cutoverFallbackRollback';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cutover fallback rollback emergency restore', () => {
  it('keeps candidate state only when migration, backend, data, write, and backup are safe', () => {
    expect(evaluateCutoverFallbackRollback({
      sourceOfTruthState: 'backend-primary-candidate',
      migrationDryRunSafe: true,
      backendAvailable: true,
      backendDataValid: true,
      backendWriteSucceeded: true,
      localStorageBackupAvailable: true,
    })).toEqual({
      fallbackUsed: false,
      rollbackAvailable: true,
      rollbackPerformed: false,
      emergencyRestoreAvailable: true,
      localStorageBackupPreserved: true,
      localStorageCorrupted: false,
      sourceOfTruthState: 'backend-primary-candidate',
      reason: 'backend_candidate_safe',
    });
  });

  it('falls back for backend unavailable, invalid backend data, and missing backup', () => {
    expect(evaluateCutoverFallbackRollback({
      migrationDryRunSafe: true,
      backendAvailable: false,
      backendDataValid: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      fallbackUsed: true,
      sourceOfTruthState: 'fallback-localStorage',
      reason: 'backend_unavailable',
      localStorageBackupPreserved: true,
      localStorageCorrupted: false,
    });
    expect(evaluateCutoverFallbackRollback({
      migrationDryRunSafe: true,
      backendAvailable: true,
      backendDataValid: false,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      fallbackUsed: true,
      sourceOfTruthState: 'fallback-localStorage',
      reason: 'backend_data_invalid',
      localStorageCorrupted: false,
    });
    expect(evaluateCutoverFallbackRollback({
      localStorageBackupAvailable: false,
    })).toMatchObject({
      fallbackUsed: true,
      sourceOfTruthState: 'fallback-localStorage',
      reason: 'localStorage_backup_required',
    });
  });

  it('keeps localStorage-primary on failed migration and rolls back failed writes', () => {
    expect(evaluateCutoverFallbackRollback({
      migrationDryRunSafe: false,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      sourceOfTruthState: 'localStorage-primary',
      reason: 'migration_dry_run_not_safe',
      rollbackAvailable: true,
    });
    expect(evaluateCutoverFallbackRollback({
      migrationDryRunSafe: true,
      backendAvailable: true,
      backendDataValid: true,
      backendWriteSucceeded: false,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      fallbackUsed: true,
      rollbackAvailable: true,
      rollbackPerformed: true,
      sourceOfTruthState: 'fallback-localStorage',
      reason: 'backend_write_failed',
    });
  });

  it('supports manual disable and emergency restore without deleting backup', () => {
    expect(evaluateCutoverFallbackRollback({ manualDisable: true })).toMatchObject({
      fallbackUsed: true,
      sourceOfTruthState: 'localStorage-primary',
      reason: 'manual_disable_to_localStorage_primary',
      localStorageBackupPreserved: true,
    });
    expect(evaluateCutoverFallbackRollback({
      emergencyRestoreRequested: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      fallbackUsed: true,
      rollbackAvailable: true,
      rollbackPerformed: true,
      sourceOfTruthState: 'emergency-localStorage',
      reason: 'emergency_restore_requested',
      localStorageBackupPreserved: true,
    });
  });

  it('keeps source free of HTTP recovery surfaces', () => {
    const source = readSource('src/productionCutover/cutoverFallbackRollback.ts');

    for (const forbidden of [
      'reset/recovery over HTTP',
      'backup/import/export over HTTP',
      'POST /data-health/repair/apply',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents Task 9.8 boundaries and next task', () => {
    const doc = readSource('docs/CUTOVER_FALLBACK_ROLLBACK_EMERGENCY_RESTORE.md');

    for (const expected of [
      'Task 9.8 Cutover Fallback, Rollback & Emergency Restore V1',
      'Backend unavailable falls back to localStorage.',
      'Backend invalid or corrupt data falls back to localStorage and does not overwrite local data.',
      'Migration dry-run failure keeps localStorage-primary.',
      'Emergency restore moves to emergency-localStorage when requested.',
      'Recommended next task: Task 9.9 Cutover Confirmation UX & Safety Copy V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
