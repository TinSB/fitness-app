export type LocalToCloudOwnerScope =
  | 'anonymous-local'
  | 'device-local'
  | 'backend-primary-candidate'
  | 'cloud-account-candidate';

export type LocalToCloudOwner = {
  scope: LocalToCloudOwnerScope;
  ownerId: string;
  deviceId?: string;
  accountId?: string;
};

export type LocalToCloudSchemaStatus = 'valid' | 'invalid' | 'unchecked';
export type LocalToCloudBackupStatus = 'available' | 'missing';

export type LocalToCloudMigrationWarningCode =
  | 'manual_confirmation_required'
  | 'anonymous_local_requires_linking'
  | 'backend_primary_candidate_detected'
  | 'existing_cloud_data_requires_review';

export type LocalToCloudMigrationBlockingErrorCode =
  | 'owner_scope_missing'
  | 'account_candidate_missing'
  | 'backend_primary_not_ready'
  | 'cloud_repository_unavailable'
  | 'schema_invalid'
  | 'migration_incompatible'
  | 'backup_missing'
  | 'owner_scope_mismatch'
  | 'existing_cloud_conflict';

export type LocalToCloudMigrationDryRunInput<TAppData = unknown> = {
  localOwner?: LocalToCloudOwner | null;
  accountCandidate?: LocalToCloudOwner | null;
  backendPrimaryCandidateReady?: boolean;
  cloudRepositoryAvailable?: boolean;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  migrationCompatible?: boolean;
  backupAvailable?: boolean;
  existingCloudOwner?: LocalToCloudOwner | null;
  existingCloudSnapshotHash?: string | null;
  localSnapshotHash?: string | null;
  manualConfirmation?: boolean;
};

export type LocalToCloudEstimatedCloudWrite = {
  operationType: 'create_cloud_appdata_snapshot_candidate';
  wouldWrite: boolean;
  accountId: string | null;
  sourceSnapshotHash: string | null;
  targetOwner: LocalToCloudOwner | null;
};

export type LocalToCloudMigrationDryRunResult = {
  ok: boolean;
  safeToUpload: boolean;
  warnings: LocalToCloudMigrationWarningCode[];
  blockingErrors: LocalToCloudMigrationBlockingErrorCode[];
  ownerBefore: LocalToCloudOwner | null;
  ownerAfterCandidate: LocalToCloudOwner | null;
  schemaStatus: LocalToCloudSchemaStatus;
  backupStatus: LocalToCloudBackupStatus;
  estimatedCloudWrite: LocalToCloudEstimatedCloudWrite;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
};

const cloneOwner = (owner: LocalToCloudOwner): LocalToCloudOwner => ({
  scope: owner.scope,
  ownerId: owner.ownerId,
  ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
  ...(owner.accountId ? { accountId: owner.accountId } : {}),
});

const validOwner = (owner: LocalToCloudOwner | null | undefined): owner is LocalToCloudOwner =>
  !!owner &&
  !!owner.scope &&
  !!owner.ownerId &&
  (owner.scope !== 'cloud-account-candidate' || !!owner.accountId);

const sameOwner = (left: LocalToCloudOwner, right: LocalToCloudOwner): boolean =>
  left.scope === right.scope &&
  left.ownerId === right.ownerId &&
  left.accountId === right.accountId;

export const runLocalToCloudMigrationDryRun = <TAppData = unknown>(
  input: LocalToCloudMigrationDryRunInput<TAppData> = {},
): LocalToCloudMigrationDryRunResult => {
  const warnings: LocalToCloudMigrationWarningCode[] = [];
  const blockingErrors: LocalToCloudMigrationBlockingErrorCode[] = [];
  const ownerBefore = input.localOwner ? cloneOwner(input.localOwner) : null;
  const ownerAfterCandidate = input.accountCandidate ? cloneOwner(input.accountCandidate) : null;

  if (!validOwner(ownerBefore)) {
    blockingErrors.push('owner_scope_missing');
  }

  if (!validOwner(ownerAfterCandidate) || ownerAfterCandidate.scope !== 'cloud-account-candidate') {
    blockingErrors.push('account_candidate_missing');
  }

  if (ownerBefore?.scope === 'anonymous-local') {
    warnings.push('anonymous_local_requires_linking');
  }

  if (ownerBefore?.scope === 'backend-primary-candidate') {
    warnings.push('backend_primary_candidate_detected');
  }

  if (input.backendPrimaryCandidateReady !== true) {
    blockingErrors.push('backend_primary_not_ready');
  }

  if (input.cloudRepositoryAvailable !== true) {
    blockingErrors.push('cloud_repository_unavailable');
  }

  const schemaStatus: LocalToCloudSchemaStatus =
    input.appData == null
      ? 'unchecked'
      : input.schemaValidator?.(input.appData) === false
        ? 'invalid'
        : 'valid';

  if (schemaStatus !== 'valid') {
    blockingErrors.push('schema_invalid');
  }

  if (input.migrationCompatible !== true) {
    blockingErrors.push('migration_incompatible');
  }

  const backupStatus: LocalToCloudBackupStatus = input.backupAvailable === true ? 'available' : 'missing';
  if (backupStatus !== 'available') {
    blockingErrors.push('backup_missing');
  }

  if (validOwner(input.existingCloudOwner)) {
    warnings.push('existing_cloud_data_requires_review');
    if (ownerAfterCandidate && !sameOwner(input.existingCloudOwner, ownerAfterCandidate)) {
      blockingErrors.push('owner_scope_mismatch');
    }
  }

  if (
    input.existingCloudSnapshotHash &&
    input.localSnapshotHash &&
    input.existingCloudSnapshotHash !== input.localSnapshotHash
  ) {
    blockingErrors.push('existing_cloud_conflict');
  }

  if (input.manualConfirmation !== true) {
    warnings.push('manual_confirmation_required');
  }

  const estimatedCloudWrite: LocalToCloudEstimatedCloudWrite = {
    operationType: 'create_cloud_appdata_snapshot_candidate',
    wouldWrite: blockingErrors.length === 0 && input.manualConfirmation === true,
    accountId: ownerAfterCandidate?.accountId ?? null,
    sourceSnapshotHash: input.localSnapshotHash ?? null,
    targetOwner: ownerAfterCandidate,
  };

  const safeToUpload = estimatedCloudWrite.wouldWrite;

  return {
    ok: blockingErrors.length === 0,
    safeToUpload,
    warnings,
    blockingErrors,
    ownerBefore,
    ownerAfterCandidate,
    schemaStatus,
    backupStatus,
    estimatedCloudWrite,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
  };
};
