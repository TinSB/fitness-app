export type CloudConflictType =
  | 'local_newer'
  | 'cloud_newer'
  | 'both_changed'
  | 'owner_mismatch'
  | 'schema_mismatch'
  | 'cloud_missing'
  | 'local_missing'
  | 'backend_primary_mismatch'
  | 'session_account_mismatch'
  | 'device_identity_mismatch';

export type CloudConflictSeverity = 'info' | 'warning' | 'blocking';

export type CloudConflictDetectionInput = {
  localExists?: boolean;
  cloudExists?: boolean;
  localUpdatedAt?: string | null;
  cloudUpdatedAt?: string | null;
  localBaseHash?: string | null;
  cloudBaseHash?: string | null;
  localSnapshotHash?: string | null;
  cloudSnapshotHash?: string | null;
  ownerMatches?: boolean;
  schemaMatches?: boolean;
  backendPrimaryMatches?: boolean;
  sessionAccountMatches?: boolean;
  deviceIdentityMatches?: boolean;
};

export type CloudConflictDetectionResult = {
  conflictType: CloudConflictType;
  severity: CloudConflictSeverity;
  recommendedAction: string;
  manualResolutionRequired: true;
  canAutoApply: false;
};

const conflict = (
  conflictType: CloudConflictType,
  severity: CloudConflictSeverity,
  recommendedAction: string,
): CloudConflictDetectionResult => ({
  conflictType,
  severity,
  recommendedAction,
  manualResolutionRequired: true,
  canAutoApply: false,
});

export const detectCloudSyncConflict = (
  input: CloudConflictDetectionInput = {},
): CloudConflictDetectionResult => {
  if (input.localExists === false) {
    return conflict('local_missing', 'blocking', 'Review emergency local backup before considering any cloud candidate.');
  }

  if (input.cloudExists === false) {
    return conflict('cloud_missing', 'warning', 'Cloud candidate is missing; review local snapshot before creating a cloud snapshot candidate.');
  }

  if (input.ownerMatches === false) {
    return conflict('owner_mismatch', 'blocking', 'Reject until owner scope is corrected.');
  }

  if (input.schemaMatches === false) {
    return conflict('schema_mismatch', 'blocking', 'Reject until schema compatibility is reviewed.');
  }

  if (input.backendPrimaryMatches === false) {
    return conflict('backend_primary_mismatch', 'blocking', 'Keep local fallback and backend-primary candidate disabled until reviewed.');
  }

  if (input.sessionAccountMatches === false) {
    return conflict('session_account_mismatch', 'blocking', 'Reject until session account and cloud owner are aligned.');
  }

  if (input.deviceIdentityMatches === false) {
    return conflict('device_identity_mismatch', 'blocking', 'Require manual device identity review.');
  }

  const bothChanged =
    !!input.localBaseHash &&
    !!input.cloudBaseHash &&
    !!input.localSnapshotHash &&
    !!input.cloudSnapshotHash &&
    input.localBaseHash !== input.localSnapshotHash &&
    input.cloudBaseHash !== input.cloudSnapshotHash &&
    input.localSnapshotHash !== input.cloudSnapshotHash;

  if (bothChanged) {
    return conflict('both_changed', 'blocking', 'Use manual conflict resolution; no last-write-wins default.');
  }

  if (input.localUpdatedAt && input.cloudUpdatedAt && input.localUpdatedAt > input.cloudUpdatedAt) {
    return conflict('local_newer', 'warning', 'Review local data before creating a cloud snapshot candidate.');
  }

  if (input.localUpdatedAt && input.cloudUpdatedAt && input.cloudUpdatedAt > input.localUpdatedAt) {
    return conflict('cloud_newer', 'warning', 'Review cloud candidate before any future local apply step.');
  }

  return conflict('both_changed', 'info', 'No safe automatic choice is assumed; manual review remains required.');
};
