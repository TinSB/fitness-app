export type SourceOfTruthRuntimeSwitchState =
  | 'localStorage-primary'
  | 'backend-read-candidate'
  | 'backend-primary-candidate'
  | 'fallback-localStorage'
  | 'emergency-localStorage'
  | 'disabled';

export type SourceOfTruthRuntimeSwitchInput = {
  requestedState?: SourceOfTruthRuntimeSwitchState;
  explicitOptIn?: boolean;
  backendAvailable?: boolean;
  localStorageBackupAvailable?: boolean;
  runtimeSource?: string;
  backendBaseUrl?: string;
  emergencyRestoreRequested?: boolean;
  manualDisable?: boolean;
};

export type SourceOfTruthRuntimeSwitchResult = {
  state: SourceOfTruthRuntimeSwitchState;
  sourceOfTruth: 'localStorage' | 'backend-primary-candidate';
  backendPrimaryCandidateEnabled: boolean;
  localStorageFallbackAvailable: true;
  localStorageMigrationSourceAvailable: true;
  localStorageEmergencyBackupAvailable: true;
  localStorageDeleted: false;
  allowed: boolean;
  reason: string;
};

const localStorageResult = (
  state: SourceOfTruthRuntimeSwitchState,
  reason: string,
  allowed = true,
): SourceOfTruthRuntimeSwitchResult => ({
  state,
  sourceOfTruth: 'localStorage',
  backendPrimaryCandidateEnabled: false,
  localStorageFallbackAvailable: true,
  localStorageMigrationSourceAvailable: true,
  localStorageEmergencyBackupAvailable: true,
  localStorageDeleted: false,
  allowed,
  reason,
});

const devPrimaryRuntimeSource = ['api', 'primary-dev'].join('-');
const devReadonlyRuntimeSource = ['api', 'readonly'].join('-');

const isDevRuntimeSource = (value: string | undefined) =>
  value === devPrimaryRuntimeSource || value === devReadonlyRuntimeSource;

const isLocalBackendBaseUrl = (value: string | undefined) =>
  value !== undefined && /^(http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/\[::1\])/i.test(value);

export const resolveSourceOfTruthRuntimeSwitchGuard = (
  input: SourceOfTruthRuntimeSwitchInput = {},
): SourceOfTruthRuntimeSwitchResult => {
  if (input.manualDisable) return localStorageResult('disabled', 'manual_disable');
  if (input.emergencyRestoreRequested) return localStorageResult('emergency-localStorage', 'emergency_restore_requested');

  const requestedState = input.requestedState ?? 'localStorage-primary';

  if (requestedState === 'disabled') return localStorageResult('disabled', 'requested_disabled');
  if (requestedState === 'localStorage-primary') return localStorageResult('localStorage-primary', 'default_localStorage_primary');

  if (!input.explicitOptIn) {
    return localStorageResult('localStorage-primary', 'explicit_opt_in_required', false);
  }

  if (isDevRuntimeSource(input.runtimeSource) || isLocalBackendBaseUrl(input.backendBaseUrl)) {
    return localStorageResult('localStorage-primary', 'dev_api_rejected_for_production_candidate', false);
  }

  if (!input.backendAvailable) {
    return localStorageResult('fallback-localStorage', 'backend_unavailable', false);
  }

  if (requestedState === 'backend-read-candidate') {
    return {
      ...localStorageResult('backend-read-candidate', 'backend_read_candidate_enabled'),
      backendPrimaryCandidateEnabled: false,
    };
  }

  if (requestedState === 'backend-primary-candidate') {
    if (!input.localStorageBackupAvailable) {
      return localStorageResult('fallback-localStorage', 'localStorage_backup_required', false);
    }

    return {
      state: 'backend-primary-candidate',
      sourceOfTruth: 'backend-primary-candidate',
      backendPrimaryCandidateEnabled: true,
      localStorageFallbackAvailable: true,
      localStorageMigrationSourceAvailable: true,
      localStorageEmergencyBackupAvailable: true,
      localStorageDeleted: false,
      allowed: true,
      reason: 'backend_primary_candidate_enabled',
    };
  }

  return localStorageResult('localStorage-primary', 'unsupported_state', false);
};
