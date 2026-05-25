import type {
  CloudAppDataRepositoryCandidate,
  CloudAppDataSnapshotCandidate,
} from './cloudAppDataRepositoryCandidate';
import type { CloudAppDataOwner } from './cloudAppDataRepositoryCandidate';
import type { Phase21cCloudWriteShadowCandidateResult } from './cloudWriteShadowCandidate';
import type { Phase21dCloudReadMirrorVerificationResult } from './cloudReadMirrorVerification';
import type { AppData } from '../models/training-model';

export const PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID =
  'phase21e-first-upload-explicit-apply';

export type Phase21eFirstUploadExplicitApplyStatus =
  | 'disabled'
  | 'phase21d_not_ready'
  | 'explicit_apply_missing'
  | 'repository_unavailable'
  | 'schema_invalid'
  | 'runtime_boundary_unsafe'
  | 'upload_rejected'
  | 'uploaded';

export type Phase21eFirstUploadExplicitApplyBlocker =
  | 'apply_disabled'
  | 'phase21d_not_ready'
  | 'shadow_candidate_missing'
  | 'read_mirror_not_verified'
  | 'manual_review_required'
  | 'explicit_first_upload_apply_missing'
  | 'localStorage_fallback_not_confirmed'
  | 'no_silent_overwrite_not_confirmed'
  | 'backup_still_available_not_confirmed'
  | 'appdata_missing'
  | 'owner_missing'
  | 'write_repository_unavailable'
  | 'schema_invalid'
  | 'cloud_upload_rejected'
  | 'sync_runtime_already_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21eFirstUploadExplicitApplyWarning =
  | 'first_upload_explicit_only'
  | 'localStorage_remains_fallback'
  | 'no_download_performed'
  | 'no_auto_apply'
  | 'manual_conflict_required_on_difference'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase21eRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21eFirstUploadReceipt = {
  snapshotId: string | null;
  operationId: string | null;
  accountId: string | null;
  ownerUserId: string | null;
  sourceSnapshotHash: string | null;
  schemaVersion: string | null;
  createdAt: string | null;
};

export type Phase21eFirstUploadExplicitApplyInput<TAppData = AppData> = {
  enabled?: boolean;
  shadowCandidate?: Phase21cCloudWriteShadowCandidateResult | null;
  readMirrorVerification?: Phase21dCloudReadMirrorVerificationResult<TAppData> | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  writeRepository?: Pick<CloudAppDataRepositoryCandidate<TAppData>, 'writeCloudAppDataCandidate'> | null;
  explicitFirstUploadApply?: boolean;
  localStorageFallbackConfirmed?: boolean;
  noSilentOverwriteConfirmed?: boolean;
  backupStillAvailableConfirmed?: boolean;
  runtimeBoundary?: Partial<Phase21eRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  applyId?: string;
};

export type Phase21eFirstUploadExplicitApplyResult = {
  id: string;
  baseId: typeof PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID;
  phase: '21E';
  ok: boolean;
  status: Phase21eFirstUploadExplicitApplyStatus;
  readyFor21F: boolean;
  blockers: Phase21eFirstUploadExplicitApplyBlocker[];
  warnings: Phase21eFirstUploadExplicitApplyWarning[];
  userMessage: '同步完成';
  firstUploadExplicitlyApplied: boolean;
  uploadReceipt: Phase21eFirstUploadReceipt;
  cloudWriteAttempted: boolean;
  uploadPerformed: boolean;
  cloudDataChanged: boolean;
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
  requiresCloudReadAfterUpload: true;
  requiresLocalParityCheck: true;
  requiresConflictReviewBeforeApply: true;
  nextPhase: '21F - Cloud Parity Check V1';
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

const ownerFromShadowCandidate = (
  shadowCandidate: Phase21cCloudWriteShadowCandidateResult | null | undefined,
): CloudAppDataOwner | null => {
  const accountId = shadowCandidate?.shadowCandidate.accountId;
  const ownerUserId = shadowCandidate?.shadowCandidate.ownerUserId;
  if (!accountId || !ownerUserId) return null;

  return {
    scope: 'cloud-account-candidate',
    ownerId: ownerUserId,
    accountId,
  };
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase21eFirstUploadExplicitApplyBlocker[],
  boundary: Partial<Phase21eRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21eFirstUploadExplicitApplyBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'sync_runtime_already_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21eFirstUploadExplicitApplyBlocker[],
): Phase21eFirstUploadExplicitApplyStatus => {
  if (blockers.includes('apply_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (
    blockers.includes('phase21d_not_ready') ||
    blockers.includes('shadow_candidate_missing') ||
    blockers.includes('read_mirror_not_verified') ||
    blockers.includes('manual_review_required')
  ) {
    return 'phase21d_not_ready';
  }
  if (
    blockers.includes('explicit_first_upload_apply_missing') ||
    blockers.includes('localStorage_fallback_not_confirmed') ||
    blockers.includes('no_silent_overwrite_not_confirmed') ||
    blockers.includes('backup_still_available_not_confirmed')
  ) {
    return 'explicit_apply_missing';
  }
  if (blockers.includes('write_repository_unavailable') || blockers.includes('owner_missing')) {
    return 'repository_unavailable';
  }
  if (blockers.includes('schema_invalid') || blockers.includes('appdata_missing')) return 'schema_invalid';
  if (blockers.includes('cloud_upload_rejected')) return 'upload_rejected';
  return 'uploaded';
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

const receiptFromSnapshot = <TAppData>(
  snapshot: CloudAppDataSnapshotCandidate<TAppData> | null | undefined,
): Phase21eFirstUploadReceipt => {
  if (!snapshot) return emptyReceipt();
  return {
    snapshotId: snapshot.snapshotId,
    operationId: snapshot.operationId,
    accountId: snapshot.accountId,
    ownerUserId: snapshot.ownerUserId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    schemaVersion: snapshot.schemaVersion,
    createdAt: snapshot.createdAt,
  };
};

export const buildFirstUploadExplicitApply = <TAppData = AppData>(
  input: Phase21eFirstUploadExplicitApplyInput<TAppData> = {},
): Phase21eFirstUploadExplicitApplyResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21eFirstUploadExplicitApplyBlocker[] = [];
  const warnings: Phase21eFirstUploadExplicitApplyWarning[] = [
    'first_upload_explicit_only',
    'localStorage_remains_fallback',
    'no_download_performed',
    'no_auto_apply',
    'manual_conflict_required_on_difference',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'apply_disabled');
  if (input.shadowCandidate?.readyFor21D !== true || input.shadowCandidate.ok !== true) {
    addUnique(blockers, 'shadow_candidate_missing');
  }
  if (input.readMirrorVerification?.readyFor21E !== true || input.readMirrorVerification.ok !== true) {
    addUnique(blockers, 'phase21d_not_ready');
  }
  if (input.readMirrorVerification?.cloudReadMirrorVerified !== true) {
    addUnique(blockers, 'read_mirror_not_verified');
  }
  if (input.readMirrorVerification?.manualReviewRequired === true) addUnique(blockers, 'manual_review_required');
  if (input.explicitFirstUploadApply !== true) addUnique(blockers, 'explicit_first_upload_apply_missing');
  if (input.localStorageFallbackConfirmed !== true) addUnique(blockers, 'localStorage_fallback_not_confirmed');
  if (input.noSilentOverwriteConfirmed !== true) addUnique(blockers, 'no_silent_overwrite_not_confirmed');
  if (input.backupStillAvailableConfirmed !== true) addUnique(blockers, 'backup_still_available_not_confirmed');
  if (input.appData == null) addUnique(blockers, 'appdata_missing');
  if (!input.writeRepository) addUnique(blockers, 'write_repository_unavailable');
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const owner = ownerFromShadowCandidate(input.shadowCandidate);
  if (!owner) addUnique(blockers, 'owner_missing');

  const sourceSnapshotHash = input.shadowCandidate?.shadowCandidate.sourceSnapshotHash ?? null;
  const operationId = input.shadowCandidate?.shadowCandidate.operationId ?? null;
  const schemaVersion = input.shadowCandidate?.shadowCandidate.schemaVersion ?? null;
  const schemaValid =
    input.appData != null &&
    (input.schemaValidator ? input.schemaValidator(input.appData) !== false : true);
  if (input.appData != null && schemaValid !== true) addUnique(blockers, 'schema_invalid');

  let cloudWriteAttempted = false;
  let uploadReceipt = emptyReceipt();
  if (
    blockers.length === 0 &&
    input.appData != null &&
    input.writeRepository &&
    owner &&
    sourceSnapshotHash &&
    operationId &&
    schemaVersion != null
  ) {
    cloudWriteAttempted = true;
    const writeResult = input.writeRepository.writeCloudAppDataCandidate({
      appData: input.appData,
      owner,
      schemaVersion: String(schemaVersion),
      sourceSnapshotHash,
      operationId,
      manualConfirmation: true,
    });

    if (!writeResult.ok || writeResult.status !== 'write_candidate') {
      addUnique(blockers, 'cloud_upload_rejected');
    }
    uploadReceipt = receiptFromSnapshot(writeResult.snapshot);
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'uploaded';

  return {
    id: input.applyId ?? `${PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID}-${hashText(createdAt)}`,
    baseId: PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID,
    phase: '21E',
    ok,
    status,
    readyFor21F: ok,
    blockers,
    warnings,
    userMessage: '同步完成',
    firstUploadExplicitlyApplied: ok,
    uploadReceipt: ok ? uploadReceipt : emptyReceipt(),
    cloudWriteAttempted,
    uploadPerformed: ok,
    cloudDataChanged: ok,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    syncRuntimeEnabled: ok,
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    requiresCloudReadAfterUpload: true,
    requiresLocalParityCheck: true,
    requiresConflictReviewBeforeApply: true,
    nextPhase: '21F - Cloud Parity Check V1',
    createdAt,
  };
};
