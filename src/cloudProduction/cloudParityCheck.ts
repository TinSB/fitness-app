import {
  buildPhase19gCloudReadMirror,
  type Phase19gCloudReadMirrorRepository,
  type Phase19gCloudReadMirrorResult,
} from './cloudReadMirror';
import { buildAppDataSnapshotHash } from './accountBoundaryLocalInventory';
import type {
  CloudAppDataOwner,
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
} from './cloudAppDataRepositoryCandidate';
import type {
  Phase21eFirstUploadExplicitApplyResult,
  Phase21eFirstUploadReceipt,
} from './firstUploadExplicitApply';
import type { AppData } from '../models/training-model';

export const PHASE21F_CLOUD_PARITY_CHECK_ID = 'phase21f-cloud-parity-check';

export type Phase21fCloudParityCheckStatus =
  | 'disabled'
  | 'phase21e_not_ready'
  | 'explicit_parity_check_missing'
  | 'repository_unavailable'
  | 'cloud_read_rejected'
  | 'schema_invalid'
  | 'runtime_boundary_unsafe'
  | 'parity_mismatch'
  | 'parity_verified';

export type Phase21fCloudParityCheckBlocker =
  | 'parity_disabled'
  | 'phase21e_not_ready'
  | 'first_upload_not_applied'
  | 'upload_receipt_missing'
  | 'sync_runtime_not_enabled_after_upload'
  | 'explicit_cloud_read_after_upload_missing'
  | 'explicit_local_parity_check_missing'
  | 'read_repository_unavailable'
  | 'cloud_read_rejected'
  | 'cloud_missing_after_upload'
  | 'manual_review_required'
  | 'local_appdata_missing'
  | 'local_schema_invalid'
  | 'cloud_schema_invalid'
  | 'local_hash_mismatch'
  | 'cloud_metadata_hash_mismatch'
  | 'cloud_appdata_hash_mismatch'
  | 'receipt_snapshot_mismatch'
  | 'receipt_operation_mismatch'
  | 'receipt_owner_mismatch'
  | 'receipt_schema_mismatch'
  | 'receipt_created_at_mismatch'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21fCloudParityCheckWarning =
  | 'read_after_upload_only'
  | 'localStorage_remains_fallback'
  | 'no_new_upload_performed'
  | 'no_download_performed'
  | 'no_auto_apply'
  | 'manual_conflict_required_on_difference'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase21fRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21fParitySummary = {
  localSnapshotHash: string | null;
  cloudMetadataHash: string | null;
  cloudAppDataHash: string | null;
  receiptSourceSnapshotHash: string | null;
  snapshotId: string | null;
  operationId: string | null;
  accountId: string | null;
  ownerUserId: string | null;
  schemaVersion: string | null;
  createdAt: string | null;
  localMatchesReceipt: boolean;
  cloudMetadataMatchesReceipt: boolean;
  cloudAppDataMatchesReceipt: boolean;
  snapshotIdMatchesReceipt: boolean;
  operationIdMatchesReceipt: boolean;
  ownerMatchesReceipt: boolean;
  schemaMatchesReceipt: boolean;
  createdAtMatchesReceipt: boolean;
};

export type Phase21fCloudParityCheckInput<TAppData = AppData> = {
  enabled?: boolean;
  firstUploadApply?: Phase21eFirstUploadExplicitApplyResult | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  readRepository?: Phase19gCloudReadMirrorRepository<TAppData> | null;
  explicitCloudReadAfterUpload?: boolean;
  explicitLocalParityCheck?: boolean;
  runtimeBoundary?: Partial<Phase21fRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  parityCheckId?: string;
};

export type Phase21fCloudParityCheckResult<TAppData = AppData> = {
  id: string;
  baseId: typeof PHASE21F_CLOUD_PARITY_CHECK_ID;
  phase: '21F';
  ok: boolean;
  status: Phase21fCloudParityCheckStatus;
  readyFor21G: boolean;
  blockers: Phase21fCloudParityCheckBlocker[];
  warnings: Phase21fCloudParityCheckWarning[];
  userMessage: '同步完成' | '发现冲突' | '查看后再继续';
  firstUploadReceipt: Phase21eFirstUploadReceipt;
  readAfterUpload: Phase19gCloudReadMirrorResult<TAppData> | null;
  parity: Phase21fParitySummary;
  cloudReadAttempted: boolean;
  cloudReadAfterUploadVerified: boolean;
  localParityVerified: boolean;
  uploadReceiptVerified: boolean;
  conflictReviewRequired: boolean;
  firstUploadExplicitlyApplied: boolean;
  firstUploadPreviouslyPerformed: boolean;
  newUploadPerformed: false;
  cloudWriteAttempted: false;
  uploadPerformed: false;
  cloudDataChanged: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: true;
  requiresConflictReviewBeforeApply: true;
  requiresRollbackIfParityFails: true;
  nextPhase: '21G - Conflict Review V1';
  createdAt: string;
};

const hashText = (text: string): string => {
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

const emptyReceipt = (): Phase21eFirstUploadReceipt => ({
  snapshotId: null,
  operationId: null,
  accountId: null,
  ownerUserId: null,
  sourceSnapshotHash: null,
  schemaVersion: null,
  createdAt: null,
});

const receiptHasRequiredFields = (receipt: Phase21eFirstUploadReceipt) =>
  Boolean(
    receipt.snapshotId &&
    receipt.operationId &&
    receipt.accountId &&
    receipt.ownerUserId &&
    receipt.sourceSnapshotHash &&
    receipt.schemaVersion &&
    receipt.createdAt,
  );

const ownerFromReceipt = (receipt: Phase21eFirstUploadReceipt): CloudAppDataOwner | null => {
  if (!receipt.accountId || !receipt.ownerUserId) return null;
  return {
    scope: 'cloud-account-candidate',
    ownerId: receipt.ownerUserId,
    accountId: receipt.accountId,
  };
};

const emptyParitySummary = (): Phase21fParitySummary => ({
  localSnapshotHash: null,
  cloudMetadataHash: null,
  cloudAppDataHash: null,
  receiptSourceSnapshotHash: null,
  snapshotId: null,
  operationId: null,
  accountId: null,
  ownerUserId: null,
  schemaVersion: null,
  createdAt: null,
  localMatchesReceipt: false,
  cloudMetadataMatchesReceipt: false,
  cloudAppDataMatchesReceipt: false,
  snapshotIdMatchesReceipt: false,
  operationIdMatchesReceipt: false,
  ownerMatchesReceipt: false,
  schemaMatchesReceipt: false,
  createdAtMatchesReceipt: false,
});

const ownerMatchesReceipt = <TAppData>(
  snapshot: CloudAppDataSnapshotCandidate<TAppData>,
  receipt: Phase21eFirstUploadReceipt,
) =>
  snapshot.accountId === receipt.accountId &&
  snapshot.ownerUserId === receipt.ownerUserId &&
  snapshot.owner.ownerId === receipt.ownerUserId &&
  snapshot.owner.accountId === receipt.accountId;

const buildParitySummary = <TAppData>(
  appData: TAppData | null | undefined,
  snapshot: CloudAppDataSnapshotCandidate<TAppData> | null | undefined,
  receipt: Phase21eFirstUploadReceipt,
): Phase21fParitySummary => {
  const localSnapshotHash = appData == null ? null : buildAppDataSnapshotHash(appData);
  if (!snapshot) {
    return {
      ...emptyParitySummary(),
      localSnapshotHash,
      receiptSourceSnapshotHash: receipt.sourceSnapshotHash,
      localMatchesReceipt: Boolean(
        localSnapshotHash &&
        receipt.sourceSnapshotHash &&
        localSnapshotHash === receipt.sourceSnapshotHash,
      ),
    };
  }

  const cloudAppDataHash = buildAppDataSnapshotHash(snapshot.appData);
  return {
    localSnapshotHash,
    cloudMetadataHash: snapshot.sourceSnapshotHash,
    cloudAppDataHash,
    receiptSourceSnapshotHash: receipt.sourceSnapshotHash,
    snapshotId: snapshot.snapshotId,
    operationId: snapshot.operationId,
    accountId: snapshot.accountId,
    ownerUserId: snapshot.ownerUserId,
    schemaVersion: snapshot.schemaVersion,
    createdAt: snapshot.createdAt,
    localMatchesReceipt: Boolean(
      localSnapshotHash &&
      receipt.sourceSnapshotHash &&
      localSnapshotHash === receipt.sourceSnapshotHash,
    ),
    cloudMetadataMatchesReceipt: Boolean(
      receipt.sourceSnapshotHash &&
      snapshot.sourceSnapshotHash === receipt.sourceSnapshotHash,
    ),
    cloudAppDataMatchesReceipt: Boolean(
      receipt.sourceSnapshotHash &&
      cloudAppDataHash === receipt.sourceSnapshotHash,
    ),
    snapshotIdMatchesReceipt: Boolean(
      receipt.snapshotId &&
      snapshot.snapshotId === receipt.snapshotId,
    ),
    operationIdMatchesReceipt: Boolean(
      receipt.operationId &&
      snapshot.operationId === receipt.operationId,
    ),
    ownerMatchesReceipt: ownerMatchesReceipt(snapshot, receipt),
    schemaMatchesReceipt: Boolean(
      receipt.schemaVersion &&
      snapshot.schemaVersion === receipt.schemaVersion,
    ),
    createdAtMatchesReceipt: Boolean(
      receipt.createdAt &&
      snapshot.createdAt === receipt.createdAt,
    ),
  };
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase21fCloudParityCheckBlocker[],
  boundary: Partial<Phase21fRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === false) addUnique(blockers, 'sync_runtime_not_enabled_after_upload');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21fCloudParityCheckBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const hasParityMismatchBlocker = (blockers: Phase21fCloudParityCheckBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'manual_review_required' ||
    blocker === 'local_hash_mismatch' ||
    blocker === 'cloud_metadata_hash_mismatch' ||
    blocker === 'cloud_appdata_hash_mismatch' ||
    blocker === 'receipt_snapshot_mismatch' ||
    blocker === 'receipt_operation_mismatch' ||
    blocker === 'receipt_owner_mismatch' ||
    blocker === 'receipt_schema_mismatch' ||
    blocker === 'receipt_created_at_mismatch'
  ));

const statusFromBlockers = (
  blockers: Phase21fCloudParityCheckBlocker[],
): Phase21fCloudParityCheckStatus => {
  if (blockers.includes('parity_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (
    blockers.includes('phase21e_not_ready') ||
    blockers.includes('first_upload_not_applied') ||
    blockers.includes('upload_receipt_missing') ||
    blockers.includes('sync_runtime_not_enabled_after_upload')
  ) {
    return 'phase21e_not_ready';
  }
  if (
    blockers.includes('explicit_cloud_read_after_upload_missing') ||
    blockers.includes('explicit_local_parity_check_missing')
  ) {
    return 'explicit_parity_check_missing';
  }
  if (blockers.includes('read_repository_unavailable')) return 'repository_unavailable';
  if (blockers.includes('local_appdata_missing') || blockers.includes('local_schema_invalid')) {
    return 'schema_invalid';
  }
  if (
    blockers.includes('cloud_read_rejected') ||
    blockers.includes('cloud_missing_after_upload')
  ) {
    return 'cloud_read_rejected';
  }
  if (blockers.includes('cloud_schema_invalid')) return 'schema_invalid';
  if (hasParityMismatchBlocker(blockers)) return 'parity_mismatch';
  return 'parity_verified';
};

const addParityBlockers = (
  blockers: Phase21fCloudParityCheckBlocker[],
  parity: Phase21fParitySummary,
) => {
  if (!parity.localMatchesReceipt) addUnique(blockers, 'local_hash_mismatch');
  if (!parity.cloudMetadataMatchesReceipt) addUnique(blockers, 'cloud_metadata_hash_mismatch');
  if (!parity.cloudAppDataMatchesReceipt) addUnique(blockers, 'cloud_appdata_hash_mismatch');
  if (!parity.snapshotIdMatchesReceipt) addUnique(blockers, 'receipt_snapshot_mismatch');
  if (!parity.operationIdMatchesReceipt) addUnique(blockers, 'receipt_operation_mismatch');
  if (!parity.ownerMatchesReceipt) addUnique(blockers, 'receipt_owner_mismatch');
  if (!parity.schemaMatchesReceipt) addUnique(blockers, 'receipt_schema_mismatch');
  if (!parity.createdAtMatchesReceipt) addUnique(blockers, 'receipt_created_at_mismatch');
};

export const buildCloudParityCheck = <TAppData = AppData>(
  input: Phase21fCloudParityCheckInput<TAppData> = {},
): Phase21fCloudParityCheckResult<TAppData> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21fCloudParityCheckBlocker[] = [];
  const warnings: Phase21fCloudParityCheckWarning[] = [
    'read_after_upload_only',
    'localStorage_remains_fallback',
    'no_new_upload_performed',
    'no_download_performed',
    'no_auto_apply',
    'manual_conflict_required_on_difference',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];
  const receipt = input.firstUploadApply?.uploadReceipt ?? emptyReceipt();

  if (input.enabled !== true) addUnique(blockers, 'parity_disabled');
  if (input.firstUploadApply?.readyFor21F !== true || input.firstUploadApply.ok !== true) {
    addUnique(blockers, 'phase21e_not_ready');
  }
  if (
    input.firstUploadApply?.firstUploadExplicitlyApplied !== true ||
    input.firstUploadApply.uploadPerformed !== true
  ) {
    addUnique(blockers, 'first_upload_not_applied');
  }
  if (!receiptHasRequiredFields(receipt)) addUnique(blockers, 'upload_receipt_missing');
  if (input.firstUploadApply?.syncRuntimeEnabled !== true) {
    addUnique(blockers, 'sync_runtime_not_enabled_after_upload');
  }
  if (input.explicitCloudReadAfterUpload !== true) {
    addUnique(blockers, 'explicit_cloud_read_after_upload_missing');
  }
  if (input.explicitLocalParityCheck !== true) {
    addUnique(blockers, 'explicit_local_parity_check_missing');
  }
  if (input.appData == null) addUnique(blockers, 'local_appdata_missing');
  const localSchemaValid =
    input.appData != null &&
    (input.schemaValidator ? input.schemaValidator(input.appData) !== false : true);
  if (input.appData != null && localSchemaValid !== true) addUnique(blockers, 'local_schema_invalid');
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const owner = ownerFromReceipt(receipt);
  let readAfterUpload: Phase19gCloudReadMirrorResult<TAppData> | null = null;
  let readResult: CloudAppDataRepositoryCandidateResult<TAppData> | null = null;
  if (blockers.length === 0) {
    if (!input.readRepository) {
      addUnique(blockers, 'read_repository_unavailable');
    } else {
      readResult = input.readRepository.readLatestCloudAppDataCandidate();
      readAfterUpload = buildPhase19gCloudReadMirror({
        enabled: true,
        accountReady: true,
        expectedOwner: owner,
        localSnapshot: {
          schemaVersion: receipt.schemaVersion,
          sourceSnapshotHash: receipt.sourceSnapshotHash,
          updatedAt: receipt.createdAt,
        },
        repository: {
          readLatestCloudAppDataCandidate: () => readResult as CloudAppDataRepositoryCandidateResult<TAppData>,
        },
        schemaValidator: input.schemaValidator,
      });

      if (readAfterUpload.status === 'cloud_missing') addUnique(blockers, 'cloud_missing_after_upload');
      if (readAfterUpload.status === 'rejected') addUnique(blockers, 'cloud_read_rejected');
      if (readAfterUpload.blockers.includes('cloud_data_invalid')) addUnique(blockers, 'cloud_schema_invalid');
      if (readAfterUpload.requiresManualReview) addUnique(blockers, 'manual_review_required');
    }
  }

  const parity = buildParitySummary(input.appData, readResult?.snapshot, receipt);
  if (readResult?.ok === true && readResult.snapshot) addParityBlockers(blockers, parity);

  const status = statusFromBlockers(blockers);
  const ok = status === 'parity_verified';
  const conflictReviewRequired = hasParityMismatchBlocker(blockers);
  const firstUploadReady =
    input.firstUploadApply?.readyFor21F === true &&
    input.firstUploadApply.ok === true &&
    input.firstUploadApply.firstUploadExplicitlyApplied === true &&
    input.firstUploadApply.uploadPerformed === true;

  return {
    id: input.parityCheckId ?? `${PHASE21F_CLOUD_PARITY_CHECK_ID}-${hashText(createdAt)}`,
    baseId: PHASE21F_CLOUD_PARITY_CHECK_ID,
    phase: '21F',
    ok,
    status,
    readyFor21G: ok,
    blockers,
    warnings,
    userMessage: ok ? '同步完成' : conflictReviewRequired ? '发现冲突' : '查看后再继续',
    firstUploadReceipt: receipt,
    readAfterUpload,
    parity,
    cloudReadAttempted: readAfterUpload !== null,
    cloudReadAfterUploadVerified:
      ok &&
      readAfterUpload?.status === 'mirrored' &&
      readAfterUpload.requiresManualReview === false,
    localParityVerified: ok && parity.localMatchesReceipt && parity.cloudAppDataMatchesReceipt,
    uploadReceiptVerified:
      ok &&
      parity.snapshotIdMatchesReceipt &&
      parity.operationIdMatchesReceipt &&
      parity.ownerMatchesReceipt &&
      parity.schemaMatchesReceipt &&
      parity.createdAtMatchesReceipt,
    conflictReviewRequired,
    firstUploadExplicitlyApplied: firstUploadReady,
    firstUploadPreviouslyPerformed: firstUploadReady,
    newUploadPerformed: false,
    cloudWriteAttempted: false,
    uploadPerformed: false,
    cloudDataChanged: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    syncRuntimeEnabled:
      input.firstUploadApply?.syncRuntimeEnabled === true &&
      !blockers.includes('phase21e_not_ready') &&
      !blockers.includes('first_upload_not_applied') &&
      !hasRuntimeBoundaryBlocker(blockers),
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    requiresConflictReviewBeforeApply: true,
    requiresRollbackIfParityFails: true,
    nextPhase: '21G - Conflict Review V1',
    createdAt,
  };
};
