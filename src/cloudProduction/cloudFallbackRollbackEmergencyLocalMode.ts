export type CloudFallbackReason =
  | 'cloud_unavailable'
  | 'push_failed'
  | 'pull_failed'
  | 'conflict_unresolved'
  | 'owner_mismatch'
  | 'invalid_cloud_data'
  | 'auth_session_invalid'
  | 'manual_abort'
  | 'rollback_to_local'
  | 'emergency_local_mode';

export type CloudFallbackRollbackInput = {
  reason?: CloudFallbackReason;
  localStorageAvailable?: boolean;
  emergencyBackupAvailable?: boolean;
  rollbackRequested?: boolean;
  rollbackSnapshotAvailable?: boolean;
};

export type CloudFallbackRollbackResult = {
  localAppAvailable: boolean;
  fallbackLocalStorageAvailable: boolean;
  emergencyLocalAvailable: boolean;
  cloudCandidateDisabled: boolean;
  rollbackAvailable: boolean;
  rollbackPerformed: boolean;
  localDataDeleted: false;
  sourceOfTruthChanged: false;
  reason: CloudFallbackReason;
};

export const resolveCloudFallbackRollbackEmergencyLocalMode = (
  input: CloudFallbackRollbackInput = {},
): CloudFallbackRollbackResult => {
  const reason = input.reason ?? 'cloud_unavailable';
  const fallbackLocalStorageAvailable = input.localStorageAvailable !== false;
  const emergencyLocalAvailable = input.emergencyBackupAvailable !== false;
  const rollbackAvailable = input.rollbackSnapshotAvailable === true || fallbackLocalStorageAvailable;
  const rollbackPerformed = input.rollbackRequested === true && rollbackAvailable;

  return {
    localAppAvailable: fallbackLocalStorageAvailable || emergencyLocalAvailable,
    fallbackLocalStorageAvailable,
    emergencyLocalAvailable,
    cloudCandidateDisabled: true,
    rollbackAvailable,
    rollbackPerformed,
    localDataDeleted: false,
    sourceOfTruthChanged: false,
    reason,
  };
};
