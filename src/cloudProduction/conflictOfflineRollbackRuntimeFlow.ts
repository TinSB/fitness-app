import {
  buildPhase19kConflictOfflineRollbackAcceptance,
  type Phase19kBoundaryProofLike,
  type Phase19kConflictOfflineRollbackAcceptanceResult,
  type Phase19kConflictReviewLike,
  type Phase19kOfflineProofLike,
  type Phase19kRollbackProofLike,
} from './conflictOfflineRollbackAcceptance';
import type { Phase20fCloudReadWriteVerificationResult } from './cloudReadWriteVerificationFlow';

export const PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID =
  'phase20g-conflict-offline-rollback-runtime-flow';

export type Phase20gConflictOfflineRollbackStatus =
  | 'disabled'
  | 'phase20f_not_ready'
  | 'conflict_review_missing'
  | 'offline_unavailable'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'boundary_drift'
  | 'source_of_truth_unsafe'
  | 'ready_for_production_acceptance';

export type Phase20gConflictOfflineRollbackBlocker =
  | 'flow_disabled'
  | 'phase20f_not_ready'
  | 'cloud_write_candidate_missing'
  | 'upload_performed'
  | 'download_performed'
  | 'auto_apply_available'
  | 'local_data_changed'
  | 'source_of_truth_changed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'localStorage_deleted'
  | 'fallback_localStorage_unavailable'
  | 'conflict_review_missing'
  | 'offline_training_unavailable'
  | 'background_work_not_disabled'
  | 'fake_success_possible'
  | 'cloud_unavailable_blocks_training'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'route_boundary_changed'
  | 'package_or_lockfile_changed'
  | 'schema_changed';

export type Phase20gConflictOfflineRollbackWarning =
  | 'runtime_flow_only'
  | 'manual_review_required'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase20gRuntimeBoundaryEvidence = {
  cloudPrimaryEnabled?: boolean;
  defaultSyncEnabled?: boolean;
  backgroundWorkEnabled?: boolean;
  sourceOfTruthChanged?: boolean;
  localStorageDeleted?: boolean;
};

export type Phase20gConflictOfflineRollbackInput<TAppData = unknown> = {
  enabled?: boolean;
  verificationFlow?: Phase20fCloudReadWriteVerificationResult<TAppData> | null;
  conflictReview?: Phase19kConflictReviewLike | null;
  offlineProof?: Phase19kOfflineProofLike | null;
  rollbackProof?: Phase19kRollbackProofLike | null;
  boundaryProof?: Phase19kBoundaryProofLike | null;
  runtimeBoundary?: Phase20gRuntimeBoundaryEvidence | null;
  nowIso?: string;
  flowId?: string;
};

export type Phase20gConflictOfflineRollbackResult = {
  id: string;
  baseId: typeof PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID;
  phase: '20G';
  ok: boolean;
  status: Phase20gConflictOfflineRollbackStatus;
  readyFor20H: boolean;
  blockers: Phase20gConflictOfflineRollbackBlocker[];
  warnings: Phase20gConflictOfflineRollbackWarning[];
  userMessage: '本地数据仍会保留';
  acceptance: Phase19kConflictOfflineRollbackAcceptanceResult;
  conflictReviewAccepted: boolean;
  offlineAccepted: boolean;
  rollbackAccepted: boolean;
  emergencyLocalAccepted: boolean;
  routeBoundaryAccepted: boolean;
  cloudWriteCandidateAccepted: boolean;
  cloudReadAttempted: boolean;
  cloudWriteAttempted: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: boolean;
  productionLaunchPerformed: false;
  nextPhase: '20H - Production Acceptance With Synthetic Data V1';
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

const addVerificationBlockers = (
  blockers: Phase20gConflictOfflineRollbackBlocker[],
  verification: Phase20fCloudReadWriteVerificationResult | null | undefined,
) => {
  if (verification?.readyFor20G !== true || verification.ok !== true) {
    addUnique(blockers, 'phase20f_not_ready');
  }
  if (verification?.cloudWriteCandidateAccepted !== true) {
    addUnique(blockers, 'cloud_write_candidate_missing');
  }
  if (verification?.localStorageFallbackPreserved !== true) {
    addUnique(blockers, 'fallback_localStorage_unavailable');
  }
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20gConflictOfflineRollbackBlocker[],
  boundary: Phase20gRuntimeBoundaryEvidence | null | undefined,
) => {
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addAcceptanceBlockers = (
  blockers: Phase20gConflictOfflineRollbackBlocker[],
  acceptance: Phase19kConflictOfflineRollbackAcceptanceResult,
) => {
  for (const blocker of acceptance.blockers) {
    if (blocker === 'conflict_review_missing' || blocker === 'auto_apply_available') {
      addUnique(blockers, blocker);
    }
    if (blocker === 'offline_training_unavailable') addUnique(blockers, blocker);
    if (blocker === 'background_work_not_disabled') addUnique(blockers, blocker);
    if (blocker === 'fake_success_possible') addUnique(blockers, blocker);
    if (blocker === 'cloud_unavailable_blocks_training') addUnique(blockers, blocker);
    if (blocker === 'rollback_unavailable') addUnique(blockers, blocker);
    if (blocker === 'emergency_local_unavailable') addUnique(blockers, blocker);
    if (blocker === 'fallback_localStorage_unavailable') {
      addUnique(blockers, 'fallback_localStorage_unavailable');
    }
    if (blocker === 'route_boundary_changed') addUnique(blockers, blocker);
    if (blocker === 'package_or_lockfile_changed') addUnique(blockers, blocker);
    if (blocker === 'schema_changed') addUnique(blockers, blocker);
    if (blocker === 'source_of_truth_changed') addUnique(blockers, blocker);
    if (blocker === 'cloud_primary_enabled') addUnique(blockers, blocker);
    if (blocker === 'default_sync_enabled') addUnique(blockers, blocker);
    if (blocker === 'background_work_enabled') addUnique(blockers, blocker);
  }
};

const statusFromBlockers = (
  blockers: Phase20gConflictOfflineRollbackBlocker[],
): Phase20gConflictOfflineRollbackStatus => {
  if (blockers.includes('flow_disabled')) return 'disabled';
  if (
    blockers.includes('phase20f_not_ready') ||
    blockers.includes('cloud_write_candidate_missing')
  ) return 'phase20f_not_ready';
  if (
    blockers.includes('conflict_review_missing') ||
    blockers.includes('auto_apply_available')
  ) return 'conflict_review_missing';
  if (
    blockers.includes('offline_training_unavailable') ||
    blockers.includes('background_work_not_disabled') ||
    blockers.includes('fake_success_possible') ||
    blockers.includes('cloud_unavailable_blocks_training')
  ) return 'offline_unavailable';
  if (blockers.includes('rollback_unavailable')) return 'rollback_unavailable';
  if (blockers.includes('emergency_local_unavailable')) return 'emergency_local_unavailable';
  if (
    blockers.includes('route_boundary_changed') ||
    blockers.includes('package_or_lockfile_changed') ||
    blockers.includes('schema_changed')
  ) return 'boundary_drift';
  if (
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled') ||
    blockers.includes('localStorage_deleted') ||
    blockers.includes('fallback_localStorage_unavailable')
  ) return 'source_of_truth_unsafe';
  return 'ready_for_production_acceptance';
};

export const buildConflictOfflineRollbackRuntimeFlow = <TAppData = unknown>(
  input: Phase20gConflictOfflineRollbackInput<TAppData> = {},
): Phase20gConflictOfflineRollbackResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20gConflictOfflineRollbackBlocker[] = [];
  const warnings: Phase20gConflictOfflineRollbackWarning[] = [
    'runtime_flow_only',
    'manual_review_required',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'flow_disabled');
  addVerificationBlockers(blockers, input.verificationFlow);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const acceptance = buildPhase19kConflictOfflineRollbackAcceptance({
    enabled: input.enabled,
    syncCandidate: {
      readyForManualSyncCandidate:
        input.verificationFlow?.readyFor20G === true &&
        input.verificationFlow.cloudWriteCandidateAccepted === true,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageFallbackPreserved: input.verificationFlow?.localStorageFallbackPreserved === true,
    },
    conflictReview: input.conflictReview,
    offlineProof: input.offlineProof,
    rollbackProof: input.rollbackProof,
    boundaryProof: input.boundaryProof,
    nowIso: createdAt,
    acceptanceId: `phase20g-reused-${hashText(createdAt)}`,
  });
  addAcceptanceBlockers(blockers, acceptance);

  const status = statusFromBlockers(blockers);
  const ok = status === 'ready_for_production_acceptance';

  return {
    id: input.flowId ?? `${PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID}-${hashText(createdAt)}`,
    baseId: PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID,
    phase: '20G',
    ok,
    status,
    readyFor20H: ok,
    blockers,
    warnings,
    userMessage: '本地数据仍会保留',
    acceptance,
    conflictReviewAccepted: acceptance.conflictReviewAccepted,
    offlineAccepted: acceptance.offlineAccepted,
    rollbackAccepted: acceptance.rollbackAccepted,
    emergencyLocalAccepted: acceptance.emergencyLocalAccepted,
    routeBoundaryAccepted: acceptance.routeBoundaryAccepted,
    cloudWriteCandidateAccepted: input.verificationFlow?.cloudWriteCandidateAccepted === true,
    cloudReadAttempted: input.verificationFlow?.cloudReadAttempted === true,
    cloudWriteAttempted: input.verificationFlow?.cloudWriteAttempted === true,
    syncRuntimeEnabled: input.verificationFlow?.syncRuntimeEnabled === true && !blockers.includes('phase20f_not_ready'),
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved:
      input.verificationFlow?.localStorageFallbackPreserved === true &&
      input.rollbackProof?.fallbackLocalStorageAvailable === true,
    productionLaunchPerformed: false,
    nextPhase: '20H - Production Acceptance With Synthetic Data V1',
    createdAt,
  };
};
