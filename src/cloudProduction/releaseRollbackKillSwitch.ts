export type ReleaseKillSwitchReason =
  | 'manual_operator_request'
  | 'cloud_candidate_failure'
  | 'owner_mismatch'
  | 'unsafe_deployment_config'
  | 'monitoring_redaction_failure'
  | 'unknown';

export type ReleaseRollbackKillSwitchInput = {
  reason?: ReleaseKillSwitchReason;
  forceEmergencyLocalMode?: boolean;
  rollbackToLocalStoragePrimary?: boolean;
};

export type ReleaseRollbackKillSwitchResult = {
  cloudPullDisabled: true;
  cloudPushDisabled: true;
  supabaseAdapterDisabled: true;
  backendPrimaryDisabled: true;
  emergencyLocalModeForced: boolean;
  localStoragePrimaryRestored: boolean;
  futureExternalMonitoringDisabled: true;
  rollbackAvailable: true;
  localDataDeleted: false;
  cloudDataOverwritten: false;
  sourceOfTruthChanged: false;
  reason: ReleaseKillSwitchReason;
};

export const createReleaseRollbackKillSwitchResult = (
  input: ReleaseRollbackKillSwitchInput = {},
): ReleaseRollbackKillSwitchResult => ({
  cloudPullDisabled: true,
  cloudPushDisabled: true,
  supabaseAdapterDisabled: true,
  backendPrimaryDisabled: true,
  emergencyLocalModeForced: input.forceEmergencyLocalMode === true,
  localStoragePrimaryRestored: input.rollbackToLocalStoragePrimary !== false,
  futureExternalMonitoringDisabled: true,
  rollbackAvailable: true,
  localDataDeleted: false,
  cloudDataOverwritten: false,
  sourceOfTruthChanged: false,
  reason: input.reason ?? 'manual_operator_request',
});

export const forceEmergencyLocalReleaseMode = (
  reason: ReleaseKillSwitchReason = 'manual_operator_request',
): ReleaseRollbackKillSwitchResult => createReleaseRollbackKillSwitchResult({
  reason,
  forceEmergencyLocalMode: true,
  rollbackToLocalStoragePrimary: true,
});
