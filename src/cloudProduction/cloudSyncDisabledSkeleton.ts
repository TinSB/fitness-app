export type CloudSyncStatus =
  | 'disabled'
  | 'dry_run_only'
  | 'unavailable'
  | 'conflict_detected'
  | 'manual_confirmation_required'
  | 'unsupported';

export type CloudSyncResultState =
  | 'disabled'
  | 'dry_run_only'
  | 'conflict_detected'
  | 'manual_confirmation_required'
  | 'rejected'
  | 'safe_to_apply'
  | 'applied_candidate';

export type CloudSyncConflictReason =
  | 'local_newer_than_cloud'
  | 'cloud_newer_than_local'
  | 'both_changed_offline'
  | 'backend_write_frontend_failed'
  | 'local_mutation_cloud_rejected'
  | 'corrupt_cloud_data'
  | 'owner_mismatch'
  | 'logout_during_pending_sync'
  | 'device_clock_mismatch';

export type CloudSyncDryRunResult = {
  state: CloudSyncResultState;
  ok: boolean;
  uploadPerformed: false;
  downloadPerformed: false;
  localStorageMutated: false;
  backendPrimaryMutated: false;
  autoApplied: false;
  conflicts: CloudSyncConflictReason[];
  message: string;
};

export type CloudSyncDisabledAdapter = {
  status: CloudSyncStatus;
  enabled: false;
  networkEnabled: false;
  noAutomaticWorker: true;
  uploadEnabled: false;
  downloadEnabled: false;
  runDryRun: (conflicts?: CloudSyncConflictReason[]) => CloudSyncDryRunResult;
  apply: () => CloudSyncDryRunResult;
};

const result = (
  state: CloudSyncResultState,
  ok: boolean,
  message: string,
  conflicts: CloudSyncConflictReason[] = [],
): CloudSyncDryRunResult => ({
  state,
  ok,
  uploadPerformed: false,
  downloadPerformed: false,
  localStorageMutated: false,
  backendPrimaryMutated: false,
  autoApplied: false,
  conflicts: [...conflicts],
  message,
});

export const createCloudSyncConflictResult = (
  conflicts: CloudSyncConflictReason[],
): CloudSyncDryRunResult =>
  result(
    'manual_confirmation_required',
    false,
    'Cloud sync conflict requires manual confirmation.',
    conflicts,
  );

export const createCloudSyncDisabledSkeleton = (): CloudSyncDisabledAdapter => ({
  status: 'disabled',
  enabled: false,
  networkEnabled: false,
  noAutomaticWorker: true,
  uploadEnabled: false,
  downloadEnabled: false,
  runDryRun: (conflicts: CloudSyncConflictReason[] = []) => {
    if (conflicts.length > 0) return createCloudSyncConflictResult(conflicts);
    return result('dry_run_only', true, 'Cloud sync dry run only; no data was uploaded, downloaded, or applied.');
  },
  apply: () => result('disabled', false, 'Cloud sync apply is disabled in Phase 10.'),
});
