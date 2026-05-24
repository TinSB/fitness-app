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

export const PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID =
  'phase19i-local-to-cloud-migration-dry-run';

export type Phase19iLocalToCloudMigrationDryRunStatus =
  | 'disabled'
  | 'account_boundary_not_ready'
  | 'backup_required'
  | 'schema_invalid'
  | 'owner_mismatch'
  | 'cloud_repository_unavailable'
  | 'rls_preflight_failed'
  | 'cloud_conflict'
  | 'manual_review_required'
  | 'rollback_unavailable'
  | 'ready_for_shadow_candidate';

export type Phase19iLocalToCloudMigrationDryRunBlocker =
  | 'dry_run_disabled'
  | 'account_boundary_not_ready'
  | 'backup_missing'
  | 'backup_invalid'
  | 'backup_mismatch'
  | 'schema_invalid'
  | 'owner_mismatch'
  | 'cloud_repository_unavailable'
  | 'rls_preflight_failed'
  | 'cloud_conflict'
  | 'manual_review_required'
  | 'rollback_unavailable';

export type Phase19iLocalToCloudMigrationDryRunWarning =
  | 'dry_run_only'
  | 'localStorage_remains_source_of_truth'
  | 'first_sync_requires_review'
  | 'existing_cloud_data_requires_review'
  | 'shadow_write_still_requires_opt_in';

export type Phase19iSchemaPreflightStatus = 'valid' | 'invalid' | 'unchecked';
export type Phase19iRlsPreflightStatus = 'passed' | 'failed';
export type Phase19iRollbackPreflightStatus = 'available' | 'missing';
export type Phase19iCloudConflictPreflightStatus =
  | 'not_checked'
  | 'no_cloud_snapshot'
  | 'metadata_match'
  | 'review_required'
  | 'rejected';

export type Phase19iAccountInventoryLike = {
  ok: boolean;
  status:
    | 'ready_for_migration_dry_run'
    | 'missing_local_data'
    | 'local_schema_invalid'
    | 'account_candidate_incomplete'
    | 'owner_mismatch'
    | 'backup_required'
    | 'backup_invalid'
    | 'backup_mismatch';
  localOwner: {
    ownerId: string;
    deviceId?: string;
  } | null;
  accountCandidate: {
    accountId: string;
    ownerUserId: string;
    deviceId?: string;
    rlsOwnerMatch: boolean;
  } | null;
  appDataSummary: {
    schemaVersion: number;
    sourceSnapshotHash: string;
  } | null;
  backup: {
    status: 'valid' | 'missing' | 'invalid' | 'mismatch';
  };
  blockingErrors: (
    | 'missing_local_data'
    | 'local_schema_invalid'
    | 'account_candidate_incomplete'
    | 'owner_mismatch'
    | 'backup_missing'
    | 'backup_invalid'
    | 'backup_mismatch'
  )[];
};

export type Phase19iReadMirrorLike = {
  status:
    | 'disabled'
    | 'account_not_ready'
    | 'repository_unavailable'
    | 'cloud_missing'
    | 'rejected'
    | 'review_required'
    | 'mirrored';
  requiresManualReview: boolean;
};

export type Phase19iMigrationPackage = {
  operationType: 'migration_dry_run';
  targetTable: 'cloud_appdata_snapshots';
  operationId: string;
  requestFingerprint: string;
  accountId: string | null;
  ownerUserId: string | null;
  localOwnerId: string | null;
  deviceId: string | null;
  schemaVersion: number | null;
  sourceSnapshotHash: string | null;
  dryRunOnly: true;
  wouldCreateSnapshotCandidate: boolean;
  willUpload: false;
  willDownload: false;
};

export type Phase19iLocalToCloudMigrationDryRunInput<TAppData = unknown> = {
  enabled?: boolean;
  accountInventory?: Phase19iAccountInventoryLike | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  cloudRepositoryAvailable?: boolean;
  cloudReadMirror?: Phase19iReadMirrorLike | null;
  rlsPreflightPassed?: boolean;
  rollbackAvailable?: boolean;
  nowIso?: string;
  operationId?: string;
  requestFingerprint?: string;
};

export type Phase19iLocalToCloudMigrationDryRunResult = {
  id: string;
  baseId: typeof PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID;
  phase: '19I';
  ok: boolean;
  status: Phase19iLocalToCloudMigrationDryRunStatus;
  readyForShadowCandidate: boolean;
  requiresManualReview: boolean;
  blockers: Phase19iLocalToCloudMigrationDryRunBlocker[];
  warnings: Phase19iLocalToCloudMigrationDryRunWarning[];
  accountBoundaryStatus: Phase19iAccountInventoryLike['status'] | 'missing';
  backupStatus: Phase19iAccountInventoryLike['backup']['status'] | 'missing';
  schemaStatus: Phase19iSchemaPreflightStatus;
  rlsPreflight: Phase19iRlsPreflightStatus;
  rollbackPreflight: Phase19iRollbackPreflightStatus;
  cloudConflictPreflight: Phase19iCloudConflictPreflightStatus;
  migrationPackage: Phase19iMigrationPackage;
  noUpload: true;
  noDownload: true;
  localStorageUnchanged: true;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  syncRuntimeEnabled: false;
  nextPhase: '19J - Explicit Opt-In Single-User Sync Candidate V1';
  createdAt: string;
};

const phase19iHashText = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const addUnique = <TValue extends string>(values: TValue[], value: TValue) => {
  if (!values.includes(value)) values.push(value);
};

const phase19iSchemaStatus = <TAppData>(
  input: Phase19iLocalToCloudMigrationDryRunInput<TAppData>,
): Phase19iSchemaPreflightStatus => {
  if (input.appData == null) {
    return input.accountInventory?.appDataSummary ? 'valid' : 'unchecked';
  }
  return input.schemaValidator?.(input.appData) === false ? 'invalid' : 'valid';
};

const phase19iCloudConflictStatus = <TAppData>(
  mirror: Phase19iReadMirrorLike | null | undefined,
): Phase19iCloudConflictPreflightStatus => {
  if (!mirror) return 'not_checked';
  if (mirror.status === 'cloud_missing') return 'no_cloud_snapshot';
  if (mirror.status === 'mirrored') return 'metadata_match';
  if (mirror.status === 'review_required') return 'review_required';
  if (mirror.status === 'rejected') return 'rejected';
  return 'not_checked';
};

const phase19iStatusFromBlockers = (
  blockers: Phase19iLocalToCloudMigrationDryRunBlocker[],
): Phase19iLocalToCloudMigrationDryRunStatus => {
  if (blockers.includes('dry_run_disabled')) return 'disabled';
  if (blockers.includes('owner_mismatch')) return 'owner_mismatch';
  if (blockers.includes('account_boundary_not_ready')) return 'account_boundary_not_ready';
  if (
    blockers.includes('backup_missing') ||
    blockers.includes('backup_invalid') ||
    blockers.includes('backup_mismatch')
  ) return 'backup_required';
  if (blockers.includes('schema_invalid')) return 'schema_invalid';
  if (blockers.includes('cloud_repository_unavailable')) return 'cloud_repository_unavailable';
  if (blockers.includes('rls_preflight_failed')) return 'rls_preflight_failed';
  if (blockers.includes('cloud_conflict')) return 'cloud_conflict';
  if (blockers.includes('manual_review_required')) return 'manual_review_required';
  if (blockers.includes('rollback_unavailable')) return 'rollback_unavailable';
  return 'ready_for_shadow_candidate';
};

const buildPhase19iMigrationPackage = <TAppData>(
  input: Phase19iLocalToCloudMigrationDryRunInput<TAppData>,
  createdAt: string,
  wouldCreateSnapshotCandidate: boolean,
): Phase19iMigrationPackage => {
  const inventory = input.accountInventory ?? null;
  const account = inventory?.accountCandidate ?? null;
  const localOwner = inventory?.localOwner ?? null;
  const sourceSnapshotHash = inventory?.appDataSummary?.sourceSnapshotHash ?? null;
  const operationId = input.operationId ??
    `phase19i-migration-dry-run-${sourceSnapshotHash ?? 'missing'}-${phase19iHashText(createdAt)}`;

  return {
    operationType: 'migration_dry_run',
    targetTable: 'cloud_appdata_snapshots',
    operationId,
    requestFingerprint: input.requestFingerprint ?? operationId,
    accountId: account?.accountId ?? null,
    ownerUserId: account?.ownerUserId ?? null,
    localOwnerId: localOwner?.ownerId ?? null,
    deviceId: account?.deviceId ?? localOwner?.deviceId ?? null,
    schemaVersion: inventory?.appDataSummary?.schemaVersion ?? null,
    sourceSnapshotHash,
    dryRunOnly: true,
    wouldCreateSnapshotCandidate,
    willUpload: false,
    willDownload: false,
  };
};

export const buildPhase19iLocalToCloudMigrationDryRun = <TAppData = unknown>(
  input: Phase19iLocalToCloudMigrationDryRunInput<TAppData> = {},
): Phase19iLocalToCloudMigrationDryRunResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase19iLocalToCloudMigrationDryRunBlocker[] = [];
  const warnings: Phase19iLocalToCloudMigrationDryRunWarning[] = [
    'dry_run_only',
    'localStorage_remains_source_of_truth',
    'first_sync_requires_review',
    'shadow_write_still_requires_opt_in',
  ];

  const inventory = input.accountInventory ?? null;
  if (input.enabled !== true) {
    addUnique(blockers, 'dry_run_disabled');
  }

  if (!inventory?.ok) {
    addUnique(blockers, 'account_boundary_not_ready');
  }

  for (const boundaryError of inventory?.blockingErrors ?? []) {
    if (boundaryError === 'owner_mismatch') addUnique(blockers, 'owner_mismatch');
    if (boundaryError === 'backup_missing') addUnique(blockers, 'backup_missing');
    if (boundaryError === 'backup_invalid') addUnique(blockers, 'backup_invalid');
    if (boundaryError === 'backup_mismatch') addUnique(blockers, 'backup_mismatch');
    if (boundaryError === 'local_schema_invalid') addUnique(blockers, 'schema_invalid');
  }

  const schemaStatus = phase19iSchemaStatus(input);
  if (schemaStatus !== 'valid') addUnique(blockers, 'schema_invalid');

  if (input.cloudRepositoryAvailable !== true) {
    addUnique(blockers, 'cloud_repository_unavailable');
  }

  const rlsPreflight: Phase19iRlsPreflightStatus =
    input.rlsPreflightPassed === true && inventory?.accountCandidate?.rlsOwnerMatch === true
      ? 'passed'
      : 'failed';
  if (rlsPreflight !== 'passed') addUnique(blockers, 'rls_preflight_failed');

  const cloudConflictPreflight = phase19iCloudConflictStatus(input.cloudReadMirror);
  if (cloudConflictPreflight === 'rejected') {
    addUnique(blockers, 'cloud_conflict');
    addUnique(warnings, 'existing_cloud_data_requires_review');
  }
  if (cloudConflictPreflight === 'review_required' || input.cloudReadMirror?.requiresManualReview === true) {
    addUnique(blockers, 'manual_review_required');
    addUnique(warnings, 'existing_cloud_data_requires_review');
  }
  if (input.cloudReadMirror?.status === 'repository_unavailable') {
    addUnique(blockers, 'cloud_repository_unavailable');
  }

  const rollbackPreflight: Phase19iRollbackPreflightStatus =
    input.rollbackAvailable === true ? 'available' : 'missing';
  if (rollbackPreflight !== 'available') addUnique(blockers, 'rollback_unavailable');

  const status = phase19iStatusFromBlockers(blockers);
  const readyForShadowCandidate = status === 'ready_for_shadow_candidate';
  const sourceSnapshotHash = inventory?.appDataSummary?.sourceSnapshotHash ?? 'missing';
  const id = `${PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID}-${sourceSnapshotHash}-${phase19iHashText(createdAt)}`;

  return {
    id,
    baseId: PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID,
    phase: '19I',
    ok: readyForShadowCandidate,
    status,
    readyForShadowCandidate,
    requiresManualReview: blockers.includes('manual_review_required') || blockers.includes('cloud_conflict'),
    blockers,
    warnings,
    accountBoundaryStatus: inventory?.status ?? 'missing',
    backupStatus: inventory?.backup.status ?? 'missing',
    schemaStatus,
    rlsPreflight,
    rollbackPreflight,
    cloudConflictPreflight,
    migrationPackage: buildPhase19iMigrationPackage(input, createdAt, readyForShadowCandidate),
    noUpload: true,
    noDownload: true,
    localStorageUnchanged: true,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    syncRuntimeEnabled: false,
    nextPhase: '19J - Explicit Opt-In Single-User Sync Candidate V1',
    createdAt,
  };
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
