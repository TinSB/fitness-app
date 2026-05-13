import type { SourceOfTruthRuntimeSwitchState } from './sourceOfTruthRuntimeSwitchGuard';

export type CutoverFallbackRollbackInput = {
  sourceOfTruthState?: SourceOfTruthRuntimeSwitchState;
  backendAvailable?: boolean;
  backendDataValid?: boolean;
  migrationDryRunSafe?: boolean;
  backendWriteSucceeded?: boolean;
  localStorageBackupAvailable?: boolean;
  manualDisable?: boolean;
  emergencyRestoreRequested?: boolean;
};

export type CutoverFallbackRollbackResult = {
  fallbackUsed: boolean;
  rollbackAvailable: boolean;
  rollbackPerformed: boolean;
  emergencyRestoreAvailable: boolean;
  localStorageBackupPreserved: true;
  localStorageCorrupted: false;
  sourceOfTruthState: SourceOfTruthRuntimeSwitchState;
  reason: string;
};

const result = (
  sourceOfTruthState: SourceOfTruthRuntimeSwitchState,
  reason: string,
  options: Partial<CutoverFallbackRollbackResult> = {},
): CutoverFallbackRollbackResult => ({
  fallbackUsed: sourceOfTruthState === 'fallback-localStorage',
  rollbackAvailable: false,
  rollbackPerformed: false,
  emergencyRestoreAvailable: true,
  localStorageBackupPreserved: true,
  localStorageCorrupted: false,
  sourceOfTruthState,
  reason,
  ...options,
});

export const evaluateCutoverFallbackRollback = (
  input: CutoverFallbackRollbackInput = {},
): CutoverFallbackRollbackResult => {
  if (input.emergencyRestoreRequested) {
    return result('emergency-localStorage', 'emergency_restore_requested', {
      fallbackUsed: true,
      rollbackAvailable: input.localStorageBackupAvailable === true,
      rollbackPerformed: input.localStorageBackupAvailable === true,
    });
  }

  if (input.manualDisable) {
    return result('localStorage-primary', 'manual_disable_to_localStorage_primary', {
      fallbackUsed: true,
    });
  }

  if (!input.localStorageBackupAvailable) {
    return result('fallback-localStorage', 'localStorage_backup_required', {
      fallbackUsed: true,
    });
  }

  if (!input.migrationDryRunSafe) {
    return result('localStorage-primary', 'migration_dry_run_not_safe', {
      rollbackAvailable: true,
    });
  }

  if (!input.backendAvailable) {
    return result('fallback-localStorage', 'backend_unavailable', {
      fallbackUsed: true,
      rollbackAvailable: true,
    });
  }

  if (!input.backendDataValid) {
    return result('fallback-localStorage', 'backend_data_invalid', {
      fallbackUsed: true,
      rollbackAvailable: true,
    });
  }

  if (input.backendWriteSucceeded === false) {
    return result('fallback-localStorage', 'backend_write_failed', {
      fallbackUsed: true,
      rollbackAvailable: true,
      rollbackPerformed: true,
    });
  }

  return result(input.sourceOfTruthState ?? 'backend-primary-candidate', 'backend_candidate_safe', {
    rollbackAvailable: true,
  });
};
