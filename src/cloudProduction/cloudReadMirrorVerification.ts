import {
  buildPhase19gCloudReadMirror,
  type Phase19gCloudReadMirrorRepository,
  type Phase19gCloudReadMirrorResult,
} from './cloudReadMirror';
import type { CloudAppDataOwner } from './cloudAppDataRepositoryCandidate';
import type { Phase21cCloudWriteShadowCandidateResult } from './cloudWriteShadowCandidate';
import type { AppData } from '../models/training-model';

export const PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID =
  'phase21d-cloud-read-mirror-verification';

export type Phase21dCloudReadMirrorVerificationStatus =
  | 'disabled'
  | 'phase21c_not_ready'
  | 'explicit_verification_missing'
  | 'repository_unavailable'
  | 'cloud_read_rejected'
  | 'manual_review_required'
  | 'runtime_boundary_unsafe'
  | 'mirror_verified';

export type Phase21dCloudReadMirrorVerificationBlocker =
  | 'verification_disabled'
  | 'phase21c_not_ready'
  | 'shadow_candidate_missing'
  | 'explicit_read_verification_missing'
  | 'read_repository_unavailable'
  | 'cloud_read_rejected'
  | 'cloud_read_manual_review'
  | 'schema_invalid'
  | 'sync_runtime_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21dCloudReadMirrorVerificationWarning =
  | 'read_mirror_only'
  | 'first_upload_apply_still_required'
  | 'localStorage_remains_fallback'
  | 'no_upload_performed'
  | 'no_cloud_write_performed'
  | 'no_auto_apply'
  | 'manual_review_required_on_difference'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase21dRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21dCloudReadMirrorVerificationInput<TAppData = AppData> = {
  enabled?: boolean;
  shadowCandidate?: Phase21cCloudWriteShadowCandidateResult | null;
  readRepository?: Phase19gCloudReadMirrorRepository<TAppData> | null;
  schemaValidator?: (appData: TAppData) => boolean;
  explicitReadMirrorVerification?: boolean;
  runtimeBoundary?: Partial<Phase21dRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  verificationId?: string;
};

export type Phase21dCloudReadMirrorVerificationResult<TAppData = AppData> = {
  id: string;
  baseId: typeof PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID;
  phase: '21D';
  ok: boolean;
  status: Phase21dCloudReadMirrorVerificationStatus;
  readyFor21E: boolean;
  blockers: Phase21dCloudReadMirrorVerificationBlocker[];
  warnings: Phase21dCloudReadMirrorVerificationWarning[];
  userMessage: '查看后再继续';
  readVerification: Phase19gCloudReadMirrorResult<TAppData> | null;
  cloudReadAttempted: boolean;
  cloudReadMirrorVerified: boolean;
  cloudMissingAcceptedForFirstUpload: boolean;
  manualReviewRequired: boolean;
  requiresFirstUploadExplicitApply: true;
  requiresConflictReviewBeforeApply: true;
  syncRuntimeEnabled: false;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  cloudWriteAttempted: false;
  autoApplied: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: true;
  nextPhase: '21E - First Upload Explicit Apply V1';
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
  blockers: Phase21dCloudReadMirrorVerificationBlocker[],
  boundary: Partial<Phase21dRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21dCloudReadMirrorVerificationBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'sync_runtime_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21dCloudReadMirrorVerificationBlocker[],
): Phase21dCloudReadMirrorVerificationStatus => {
  if (blockers.includes('verification_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('phase21c_not_ready') || blockers.includes('shadow_candidate_missing')) {
    return 'phase21c_not_ready';
  }
  if (blockers.includes('explicit_read_verification_missing')) return 'explicit_verification_missing';
  if (blockers.includes('read_repository_unavailable')) return 'repository_unavailable';
  if (blockers.includes('cloud_read_rejected') || blockers.includes('schema_invalid')) {
    return 'cloud_read_rejected';
  }
  if (blockers.includes('cloud_read_manual_review')) return 'manual_review_required';
  return 'mirror_verified';
};

const readMirrorIsSafeForFirstUpload = <TAppData>(
  readVerification: Phase19gCloudReadMirrorResult<TAppData>,
) => (
  readVerification.status === 'cloud_missing' ||
  (readVerification.status === 'mirrored' && readVerification.requiresManualReview !== true)
);

export const buildCloudReadMirrorVerification = <TAppData = AppData>(
  input: Phase21dCloudReadMirrorVerificationInput<TAppData> = {},
): Phase21dCloudReadMirrorVerificationResult<TAppData> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21dCloudReadMirrorVerificationBlocker[] = [];
  const warnings: Phase21dCloudReadMirrorVerificationWarning[] = [
    'read_mirror_only',
    'first_upload_apply_still_required',
    'localStorage_remains_fallback',
    'no_upload_performed',
    'no_cloud_write_performed',
    'no_auto_apply',
    'manual_review_required_on_difference',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'verification_disabled');
  if (input.shadowCandidate?.readyFor21D !== true || input.shadowCandidate.ok !== true) {
    addUnique(blockers, 'phase21c_not_ready');
  }
  if (!input.shadowCandidate?.shadowCandidateAccepted) addUnique(blockers, 'shadow_candidate_missing');
  if (input.explicitReadMirrorVerification !== true) {
    addUnique(blockers, 'explicit_read_verification_missing');
  }
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const owner = ownerFromShadowCandidate(input.shadowCandidate);
  const sourceSnapshotHash = input.shadowCandidate?.shadowCandidate.sourceSnapshotHash ?? null;
  const schemaVersion = input.shadowCandidate?.shadowCandidate.schemaVersion ?? null;

  let readVerification: Phase19gCloudReadMirrorResult<TAppData> | null = null;
  if (blockers.length === 0) {
    if (!input.readRepository) {
      addUnique(blockers, 'read_repository_unavailable');
    } else {
      readVerification = buildPhase19gCloudReadMirror({
        enabled: true,
        accountReady: true,
        expectedOwner: owner,
        localSnapshot: {
          schemaVersion: schemaVersion == null ? null : String(schemaVersion),
          sourceSnapshotHash,
          updatedAt: input.shadowCandidate?.shadowCandidate.createdAt ?? null,
        },
        repository: input.readRepository,
        schemaValidator: input.schemaValidator,
      });

      if (readVerification.status === 'rejected') addUnique(blockers, 'cloud_read_rejected');
      if (readVerification.blockers.includes('cloud_data_invalid')) addUnique(blockers, 'schema_invalid');
      if (readVerification.requiresManualReview && !readMirrorIsSafeForFirstUpload(readVerification)) {
        addUnique(blockers, 'cloud_read_manual_review');
      }
    }
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'mirror_verified';
  const cloudReadMirrorVerified = Boolean(readVerification && readMirrorIsSafeForFirstUpload(readVerification) && ok);

  return {
    id: input.verificationId ?? `${PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID}-${hashText(createdAt)}`,
    baseId: PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID,
    phase: '21D',
    ok,
    status,
    readyFor21E: ok,
    blockers,
    warnings,
    userMessage: '查看后再继续',
    readVerification,
    cloudReadAttempted: readVerification !== null,
    cloudReadMirrorVerified,
    cloudMissingAcceptedForFirstUpload: readVerification?.status === 'cloud_missing' && ok,
    manualReviewRequired: readVerification?.requiresManualReview === true || blockers.includes('cloud_read_manual_review'),
    requiresFirstUploadExplicitApply: true,
    requiresConflictReviewBeforeApply: true,
    syncRuntimeEnabled: false,
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    cloudWriteAttempted: false,
    autoApplied: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    nextPhase: '21E - First Upload Explicit Apply V1',
    createdAt,
  };
};
