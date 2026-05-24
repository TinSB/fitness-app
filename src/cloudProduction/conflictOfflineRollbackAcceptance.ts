export const PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID =
  'phase19k-conflict-offline-rollback-acceptance';

export type Phase19kConflictOfflineRollbackAcceptanceStatus =
  | 'disabled'
  | 'sync_candidate_not_ready'
  | 'conflict_review_missing'
  | 'offline_unavailable'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'boundary_drift'
  | 'source_of_truth_unsafe'
  | 'acceptance_passed';

export type Phase19kConflictOfflineRollbackAcceptanceBlocker =
  | 'acceptance_disabled'
  | 'sync_candidate_not_ready'
  | 'upload_performed'
  | 'download_performed'
  | 'auto_apply_available'
  | 'local_data_changed'
  | 'cloud_data_changed'
  | 'source_of_truth_changed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'fallback_localStorage_unavailable'
  | 'conflict_review_missing'
  | 'offline_training_unavailable'
  | 'background_work_not_disabled'
  | 'fake_success_possible'
  | 'cloud_unavailable_blocks_training'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'local_data_deleted'
  | 'route_boundary_changed'
  | 'package_or_lockfile_changed'
  | 'schema_changed';

export type Phase19kConflictOfflineRollbackAcceptanceWarning =
  | 'acceptance_only'
  | 'manual_production_review_required'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled';

export type Phase19kSyncCandidateLike = {
  readyForManualSyncCandidate: boolean;
  uploadPerformed: boolean;
  downloadPerformed: boolean;
  autoApplied: boolean;
  localDataChanged: boolean;
  cloudDataChanged: boolean;
  sourceOfTruthChanged: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  localStorageFallbackPreserved: boolean;
};

export type Phase19kConflictReviewLike = {
  reviewed: boolean;
  manualResolutionRequired: boolean;
  canAutoApply: boolean;
  conflictType: string | null;
  resolutionCandidateReady: boolean;
  localDataChanged: boolean;
  cloudDataChanged: boolean;
  sourceOfTruthChanged: boolean;
};

export type Phase19kOfflineProofLike = {
  localTrainingAvailable: boolean;
  backgroundWorkDisabled: boolean;
  noFakeSuccess: boolean;
  canContinueWhenCloudUnavailable: boolean;
};

export type Phase19kRollbackProofLike = {
  rollbackAvailable: boolean;
  emergencyLocalAvailable: boolean;
  fallbackLocalStorageAvailable: boolean;
  localDataDeleted: boolean;
  sourceOfTruthChanged: boolean;
};

export type Phase19kBoundaryProofLike = {
  routesChanged: boolean;
  packageChanged: boolean;
  schemaChanged: boolean;
};

export type Phase19kConflictOfflineRollbackAcceptanceInput = {
  enabled?: boolean;
  syncCandidate?: Phase19kSyncCandidateLike | null;
  conflictReview?: Phase19kConflictReviewLike | null;
  offlineProof?: Phase19kOfflineProofLike | null;
  rollbackProof?: Phase19kRollbackProofLike | null;
  boundaryProof?: Phase19kBoundaryProofLike | null;
  nowIso?: string;
  acceptanceId?: string;
};

export type Phase19kConflictOfflineRollbackAcceptanceResult = {
  id: string;
  baseId: typeof PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID;
  phase: '19K';
  ok: boolean;
  status: Phase19kConflictOfflineRollbackAcceptanceStatus;
  acceptedForManualProductionReview: boolean;
  conflictReviewAccepted: boolean;
  offlineAccepted: boolean;
  rollbackAccepted: boolean;
  emergencyLocalAccepted: boolean;
  routeBoundaryAccepted: boolean;
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[];
  warnings: Phase19kConflictOfflineRollbackAcceptanceWarning[];
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  localStorageFallbackPreserved: boolean;
  nextPhase: '19L - Production Manual Acceptance V1';
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

const statusFromBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
): Phase19kConflictOfflineRollbackAcceptanceStatus => {
  if (blockers.includes('acceptance_disabled')) return 'disabled';
  if (blockers.includes('sync_candidate_not_ready')) return 'sync_candidate_not_ready';
  if (blockers.includes('conflict_review_missing') || blockers.includes('auto_apply_available')) {
    return 'conflict_review_missing';
  }
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
    blockers.includes('background_work_enabled')
  ) return 'source_of_truth_unsafe';
  return 'acceptance_passed';
};

const addSyncCandidateBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
  syncCandidate: Phase19kSyncCandidateLike | null | undefined,
) => {
  if (syncCandidate?.readyForManualSyncCandidate !== true) addUnique(blockers, 'sync_candidate_not_ready');
  if (syncCandidate?.uploadPerformed === true) addUnique(blockers, 'upload_performed');
  if (syncCandidate?.downloadPerformed === true) addUnique(blockers, 'download_performed');
  if (syncCandidate?.autoApplied === true) addUnique(blockers, 'auto_apply_available');
  if (syncCandidate?.localDataChanged === true) addUnique(blockers, 'local_data_changed');
  if (syncCandidate?.cloudDataChanged === true) addUnique(blockers, 'cloud_data_changed');
  if (syncCandidate?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (syncCandidate?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (syncCandidate?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (syncCandidate?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (syncCandidate?.localStorageFallbackPreserved !== true) {
    addUnique(blockers, 'fallback_localStorage_unavailable');
  }
};

const addConflictReviewBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
  conflictReview: Phase19kConflictReviewLike | null | undefined,
) => {
  if (conflictReview?.reviewed !== true || conflictReview.resolutionCandidateReady !== true) {
    addUnique(blockers, 'conflict_review_missing');
  }
  if (conflictReview?.canAutoApply === true) addUnique(blockers, 'auto_apply_available');
  if (conflictReview?.localDataChanged === true) addUnique(blockers, 'local_data_changed');
  if (conflictReview?.cloudDataChanged === true) addUnique(blockers, 'cloud_data_changed');
  if (conflictReview?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
};

const addOfflineBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
  offlineProof: Phase19kOfflineProofLike | null | undefined,
) => {
  if (offlineProof?.localTrainingAvailable !== true) addUnique(blockers, 'offline_training_unavailable');
  if (offlineProof?.backgroundWorkDisabled !== true) addUnique(blockers, 'background_work_not_disabled');
  if (offlineProof?.noFakeSuccess !== true) addUnique(blockers, 'fake_success_possible');
  if (offlineProof?.canContinueWhenCloudUnavailable !== true) {
    addUnique(blockers, 'cloud_unavailable_blocks_training');
  }
};

const addRollbackBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
  rollbackProof: Phase19kRollbackProofLike | null | undefined,
) => {
  if (rollbackProof?.rollbackAvailable !== true) addUnique(blockers, 'rollback_unavailable');
  if (rollbackProof?.emergencyLocalAvailable !== true) addUnique(blockers, 'emergency_local_unavailable');
  if (rollbackProof?.fallbackLocalStorageAvailable !== true) {
    addUnique(blockers, 'fallback_localStorage_unavailable');
  }
  if (rollbackProof?.localDataDeleted === true) addUnique(blockers, 'local_data_deleted');
  if (rollbackProof?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
};

const addBoundaryBlockers = (
  blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[],
  boundaryProof: Phase19kBoundaryProofLike | null | undefined,
) => {
  if (boundaryProof?.routesChanged === true) addUnique(blockers, 'route_boundary_changed');
  if (boundaryProof?.packageChanged === true) addUnique(blockers, 'package_or_lockfile_changed');
  if (boundaryProof?.schemaChanged === true) addUnique(blockers, 'schema_changed');
};

export const buildPhase19kConflictOfflineRollbackAcceptance = (
  input: Phase19kConflictOfflineRollbackAcceptanceInput = {},
): Phase19kConflictOfflineRollbackAcceptanceResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase19kConflictOfflineRollbackAcceptanceBlocker[] = [];
  const warnings: Phase19kConflictOfflineRollbackAcceptanceWarning[] = [
    'acceptance_only',
    'manual_production_review_required',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
  ];

  if (input.enabled !== true) addUnique(blockers, 'acceptance_disabled');
  addSyncCandidateBlockers(blockers, input.syncCandidate);
  addConflictReviewBlockers(blockers, input.conflictReview);
  addOfflineBlockers(blockers, input.offlineProof);
  addRollbackBlockers(blockers, input.rollbackProof);
  addBoundaryBlockers(blockers, input.boundaryProof);

  const status = statusFromBlockers(blockers);
  const ok = status === 'acceptance_passed';
  const localStorageFallbackPreserved =
    input.syncCandidate?.localStorageFallbackPreserved === true &&
    input.rollbackProof?.fallbackLocalStorageAvailable === true;

  return {
    id: input.acceptanceId ?? `${PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID}-${hashText(createdAt)}`,
    baseId: PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID,
    phase: '19K',
    ok,
    status,
    acceptedForManualProductionReview: ok,
    conflictReviewAccepted:
      input.conflictReview?.reviewed === true &&
      input.conflictReview.resolutionCandidateReady === true &&
      input.conflictReview.canAutoApply === false,
    offlineAccepted:
      input.offlineProof?.localTrainingAvailable === true &&
      input.offlineProof.backgroundWorkDisabled === true &&
      input.offlineProof.noFakeSuccess === true &&
      input.offlineProof.canContinueWhenCloudUnavailable === true,
    rollbackAccepted:
      input.rollbackProof?.rollbackAvailable === true &&
      input.rollbackProof.localDataDeleted === false &&
      input.rollbackProof.sourceOfTruthChanged === false,
    emergencyLocalAccepted: input.rollbackProof?.emergencyLocalAvailable === true,
    routeBoundaryAccepted:
      input.boundaryProof?.routesChanged === false &&
      input.boundaryProof.packageChanged === false &&
      input.boundaryProof.schemaChanged === false,
    blockers,
    warnings,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    localStorageFallbackPreserved,
    nextPhase: '19L - Production Manual Acceptance V1',
    createdAt,
  };
};
