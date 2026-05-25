import {
  resolveCloudFallbackRollbackEmergencyLocalMode,
  type CloudFallbackRollbackResult,
} from './cloudFallbackRollbackEmergencyLocalMode';
import {
  createReleaseRollbackKillSwitchResult,
  type ReleaseRollbackKillSwitchResult,
} from './releaseRollbackKillSwitch';
import type { Phase21gConflictReviewResult } from './conflictReview';
import type { AppData } from '../models/training-model';

export const PHASE21H_OFFLINE_ROLLBACK_ID = 'phase21h-offline-rollback';

export type Phase21hOfflineRollbackStatus =
  | 'disabled'
  | 'phase21g_not_ready'
  | 'offline_unavailable'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'confirmation_missing'
  | 'runtime_boundary_unsafe'
  | 'offline_rollback_ready';

export type Phase21hOfflineRollbackBlocker =
  | 'offline_rollback_disabled'
  | 'phase21g_not_ready'
  | 'localStorage_fallback_unavailable'
  | 'offline_training_unavailable'
  | 'cloud_unavailable_blocks_training'
  | 'fake_success_possible'
  | 'rollback_unavailable'
  | 'emergency_local_unavailable'
  | 'restore_local_confirmation_missing'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21hOfflineRollbackWarning =
  | 'offline_rollback_only'
  | 'localStorage_remains_fallback'
  | 'emergency_local_available'
  | 'restore_local_mode_manual_only'
  | 'cloud_candidate_disabled_when_unavailable'
  | 'no_download_performed'
  | 'no_auto_apply'
  | 'no_default_or_background_sync';

export type Phase21hRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21hOfflineRollbackInput<TAppData = AppData> = {
  enabled?: boolean;
  conflictReview?: Phase21gConflictReviewResult<TAppData> | null;
  offlineTrainingAvailable?: boolean;
  cloudUnavailableDoesNotBlockTraining?: boolean;
  noFakeSuccessConfirmed?: boolean;
  localStorageAvailable?: boolean;
  emergencyBackupAvailable?: boolean;
  rollbackSnapshotAvailable?: boolean;
  rollbackRequested?: boolean;
  restoreLocalModeRequested?: boolean;
  explicitRestoreLocalModeConfirmation?: boolean;
  cloudUnavailable?: boolean;
  runtimeBoundary?: Partial<Phase21hRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  offlineRollbackId?: string;
};

export type Phase21hOfflineRollbackResult<TAppData = AppData> = {
  id: string;
  baseId: typeof PHASE21H_OFFLINE_ROLLBACK_ID;
  phase: '21H';
  ok: boolean;
  status: Phase21hOfflineRollbackStatus;
  readyFor21I: boolean;
  blockers: Phase21hOfflineRollbackBlocker[];
  warnings: Phase21hOfflineRollbackWarning[];
  userMessage: '恢复本地模式' | '本地数据仍会保留' | '查看后再继续';
  conflictReviewAccepted: boolean;
  fallback: CloudFallbackRollbackResult;
  releaseRollback: ReleaseRollbackKillSwitchResult;
  offlineTrainingAvailable: boolean;
  cloudUnavailableAccepted: boolean;
  rollbackAvailable: boolean;
  rollbackPerformed: boolean;
  emergencyLocalAvailable: boolean;
  restoreLocalModeAvailable: boolean;
  restoreLocalModeConfirmed: boolean;
  restoreLocalModeLabel: '恢复本地模式';
  localAppAvailable: boolean;
  cloudCandidateDisabled: boolean;
  firstUploadPreviouslyPerformed: boolean;
  manualResolutionConfirmed: boolean;
  automaticConflictDecisionMade: false;
  decisionApplied: false;
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
  localStorageFallbackPreserved: boolean;
  localDataDeleted: false;
  requiresProductionAcceptance: true;
  nextPhase: '21I - Production Full Acceptance V1';
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

const addRuntimeBoundaryBlockers = (
  blockers: Phase21hOfflineRollbackBlocker[],
  boundary: Partial<Phase21hRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21hOfflineRollbackBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21hOfflineRollbackBlocker[],
): Phase21hOfflineRollbackStatus => {
  if (blockers.includes('offline_rollback_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('phase21g_not_ready')) return 'phase21g_not_ready';
  if (
    blockers.includes('localStorage_fallback_unavailable') ||
    blockers.includes('offline_training_unavailable') ||
    blockers.includes('cloud_unavailable_blocks_training') ||
    blockers.includes('fake_success_possible')
  ) {
    return 'offline_unavailable';
  }
  if (blockers.includes('rollback_unavailable')) return 'rollback_unavailable';
  if (blockers.includes('emergency_local_unavailable')) return 'emergency_local_unavailable';
  if (blockers.includes('restore_local_confirmation_missing')) return 'confirmation_missing';
  return 'offline_rollback_ready';
};

export const buildOfflineRollback = <TAppData = AppData>(
  input: Phase21hOfflineRollbackInput<TAppData> = {},
): Phase21hOfflineRollbackResult<TAppData> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21hOfflineRollbackBlocker[] = [];
  const warnings: Phase21hOfflineRollbackWarning[] = [
    'offline_rollback_only',
    'localStorage_remains_fallback',
    'emergency_local_available',
    'restore_local_mode_manual_only',
    'cloud_candidate_disabled_when_unavailable',
    'no_download_performed',
    'no_auto_apply',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'offline_rollback_disabled');
  if (input.conflictReview?.readyFor21H !== true || input.conflictReview.ok !== true) {
    addUnique(blockers, 'phase21g_not_ready');
  }
  if (input.localStorageAvailable !== true) addUnique(blockers, 'localStorage_fallback_unavailable');
  if (input.offlineTrainingAvailable !== true) addUnique(blockers, 'offline_training_unavailable');
  if (input.cloudUnavailableDoesNotBlockTraining !== true) {
    addUnique(blockers, 'cloud_unavailable_blocks_training');
  }
  if (input.noFakeSuccessConfirmed !== true) addUnique(blockers, 'fake_success_possible');
  if (input.rollbackSnapshotAvailable !== true && input.localStorageAvailable !== true) {
    addUnique(blockers, 'rollback_unavailable');
  }
  if (input.emergencyBackupAvailable !== true) addUnique(blockers, 'emergency_local_unavailable');
  if (
    (input.rollbackRequested === true || input.restoreLocalModeRequested === true) &&
    input.explicitRestoreLocalModeConfirmation !== true
  ) {
    addUnique(blockers, 'restore_local_confirmation_missing');
  }
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const fallback = resolveCloudFallbackRollbackEmergencyLocalMode({
    reason: input.restoreLocalModeRequested === true
      ? 'emergency_local_mode'
      : input.cloudUnavailable === true
        ? 'cloud_unavailable'
        : 'rollback_to_local',
    localStorageAvailable: input.localStorageAvailable === true,
    emergencyBackupAvailable: input.emergencyBackupAvailable === true,
    rollbackRequested: input.rollbackRequested === true || input.restoreLocalModeRequested === true,
    rollbackSnapshotAvailable: input.rollbackSnapshotAvailable === true,
  });
  const releaseRollback = createReleaseRollbackKillSwitchResult({
    reason: input.cloudUnavailable === true ? 'cloud_candidate_failure' : 'manual_operator_request',
    forceEmergencyLocalMode: input.restoreLocalModeRequested === true,
    rollbackToLocalStoragePrimary: true,
  });

  if (!fallback.rollbackAvailable) addUnique(blockers, 'rollback_unavailable');
  if (!fallback.emergencyLocalAvailable) addUnique(blockers, 'emergency_local_unavailable');

  const status = statusFromBlockers(blockers);
  const ok = status === 'offline_rollback_ready';
  const restoreLocalModeConfirmed =
    input.restoreLocalModeRequested === true &&
    input.explicitRestoreLocalModeConfirmation === true &&
    ok;

  return {
    id: input.offlineRollbackId ?? `${PHASE21H_OFFLINE_ROLLBACK_ID}-${hashText(createdAt)}`,
    baseId: PHASE21H_OFFLINE_ROLLBACK_ID,
    phase: '21H',
    ok,
    status,
    readyFor21I: ok,
    blockers,
    warnings,
    userMessage: restoreLocalModeConfirmed ? '恢复本地模式' : ok ? '本地数据仍会保留' : '查看后再继续',
    conflictReviewAccepted: input.conflictReview?.ok === true && input.conflictReview.readyFor21H === true,
    fallback,
    releaseRollback,
    offlineTrainingAvailable: input.offlineTrainingAvailable === true && !blockers.includes('offline_training_unavailable'),
    cloudUnavailableAccepted:
      input.cloudUnavailable === true &&
      input.cloudUnavailableDoesNotBlockTraining === true &&
      !blockers.includes('cloud_unavailable_blocks_training'),
    rollbackAvailable: fallback.rollbackAvailable && !blockers.includes('rollback_unavailable'),
    rollbackPerformed: ok && fallback.rollbackPerformed,
    emergencyLocalAvailable: fallback.emergencyLocalAvailable && !blockers.includes('emergency_local_unavailable'),
    restoreLocalModeAvailable: ok,
    restoreLocalModeConfirmed,
    restoreLocalModeLabel: '恢复本地模式',
    localAppAvailable: fallback.localAppAvailable,
    cloudCandidateDisabled: fallback.cloudCandidateDisabled,
    firstUploadPreviouslyPerformed: input.conflictReview?.firstUploadPreviouslyPerformed === true,
    manualResolutionConfirmed: input.conflictReview?.manualResolutionConfirmed === true,
    automaticConflictDecisionMade: false,
    decisionApplied: false,
    newUploadPerformed: false,
    cloudWriteAttempted: false,
    uploadPerformed: false,
    cloudDataChanged: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    syncRuntimeEnabled:
      input.conflictReview?.syncRuntimeEnabled === true &&
      input.restoreLocalModeRequested !== true &&
      !blockers.includes('phase21g_not_ready') &&
      !hasRuntimeBoundaryBlocker(blockers),
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved:
      input.conflictReview?.localStorageFallbackPreserved === true &&
      fallback.fallbackLocalStorageAvailable === true,
    localDataDeleted: false,
    requiresProductionAcceptance: true,
    nextPhase: '21I - Production Full Acceptance V1',
    createdAt,
  };
};
