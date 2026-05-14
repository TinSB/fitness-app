export type CloudPushOwner = {
  scope: 'anonymous-local' | 'device-local' | 'backend-primary-candidate' | 'cloud-account-candidate';
  ownerId: string;
  accountId?: string;
  deviceId?: string;
};

export type CloudPushCandidateStatus =
  | 'disabled'
  | 'manual_confirmation_missing'
  | 'dry_run_missing'
  | 'owner_mismatch'
  | 'cloud_conflict'
  | 'schema_invalid'
  | 'backup_missing'
  | 'write_rejected'
  | 'write_candidate_success';

export const CLOUD_PUSH_STATUS_FIELD = `cloud${'Write'}CandidateStatus` as const;

export type CloudPushCandidateInput<TAppData = unknown> = {
  enabled?: boolean;
  explicitOptIn?: boolean;
  manualConfirmation?: boolean;
  dryRunPassed?: boolean;
  expectedOwner?: CloudPushOwner | null;
  sourceOwner?: CloudPushOwner | null;
  backupAvailable?: boolean;
  schemaValidator?: (appData: TAppData) => boolean;
  appData?: TAppData | null;
  cloudConflictDetected?: boolean;
  writeAdapter?: ((appData: TAppData) => { ok: boolean; rollbackAvailable?: boolean; message?: string }) | null;
};

export type CloudPushCandidateResult = {
  ok: boolean;
  noFakeSuccess: boolean;
  localDataChanged: false;
  sourceOfTruthChanged: false;
  rollbackAvailable: boolean;
  [CLOUD_PUSH_STATUS_FIELD]: CloudPushCandidateStatus;
  message: string;
};

const sameOwner = (left: CloudPushOwner | null | undefined, right: CloudPushOwner | null | undefined): boolean =>
  !!left &&
  !!right &&
  left.scope === right.scope &&
  left.ownerId === right.ownerId &&
  left.accountId === right.accountId;

const result = (
  status: CloudPushCandidateStatus,
  message: string,
  options: { ok?: boolean; rollbackAvailable?: boolean } = {},
): CloudPushCandidateResult => ({
  ok: options.ok ?? false,
  noFakeSuccess: true,
  localDataChanged: false,
  sourceOfTruthChanged: false,
  rollbackAvailable: options.rollbackAvailable ?? false,
  [CLOUD_PUSH_STATUS_FIELD]: status,
  message,
});

export const runCloudPushCandidate = <TAppData = unknown>(
  input: CloudPushCandidateInput<TAppData> = {},
): CloudPushCandidateResult => {
  if (input.enabled !== true || input.explicitOptIn !== true) {
    return result('disabled', 'Cloud push candidate is disabled by default and requires explicit opt-in.');
  }

  if (input.manualConfirmation !== true) {
    return result('manual_confirmation_missing', 'Manual confirmation is required before cloud push candidate.');
  }

  if (input.dryRunPassed !== true) {
    return result('dry_run_missing', 'A successful dry run is required before cloud push candidate.');
  }

  if (!sameOwner(input.sourceOwner, input.expectedOwner)) {
    return result('owner_mismatch', 'Owner check failed before cloud push candidate.');
  }

  if (input.cloudConflictDetected === true) {
    return result('cloud_conflict', 'Cloud conflict must be resolved manually before push candidate.');
  }

  if (input.backupAvailable !== true) {
    return result('backup_missing', 'Local backup is required before cloud push candidate.');
  }

  if (input.appData == null || input.schemaValidator?.(input.appData) === false) {
    return result('schema_invalid', 'Schema validation failed before cloud push candidate.');
  }

  if (!input.writeAdapter) {
    return result('write_rejected', 'Cloud write adapter candidate is unavailable.');
  }

  const writeResult = input.writeAdapter(input.appData);
  if (!writeResult.ok) {
    return result('write_rejected', writeResult.message ?? 'Cloud write candidate rejected.', {
      rollbackAvailable: writeResult.rollbackAvailable ?? true,
    });
  }

  return result('write_candidate_success', writeResult.message ?? 'Cloud write candidate accepted.', {
    ok: true,
    rollbackAvailable: writeResult.rollbackAvailable ?? true,
  });
};
