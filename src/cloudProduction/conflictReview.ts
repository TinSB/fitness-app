import {
  runManualConflictResolutionCandidate,
  type ManualConflictResolutionResult,
} from './manualConflictResolutionCandidate';
import type { Phase21fCloudParityCheckResult } from './cloudParityCheck';
import type { AppData } from '../models/training-model';

export const PHASE21G_CONFLICT_REVIEW_ID = 'phase21g-conflict-review';

export type Phase21gConflictReviewStatus =
  | 'disabled'
  | 'phase21f_not_ready'
  | 'review_required'
  | 'resolution_missing'
  | 'confirmation_missing'
  | 'backup_required'
  | 'validation_missing'
  | 'runtime_boundary_unsafe'
  | 'conflict_reviewed';

export type Phase21gConflictResolutionChoice = 'none' | 'keep_local' | 'use_cloud';

export type Phase21gConflictReviewBlocker =
  | 'review_disabled'
  | 'phase21f_not_ready'
  | 'cloud_parity_missing'
  | 'conflict_review_missing'
  | 'resolution_choice_missing'
  | 'explicit_resolution_confirmation_missing'
  | 'localStorage_fallback_not_confirmed'
  | 'no_auto_apply_not_confirmed'
  | 'backup_still_available_not_confirmed'
  | 'owner_validation_missing'
  | 'schema_validation_missing'
  | 'automatic_conflict_decision_attempted'
  | 'resolution_candidate_aborted'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21gConflictReviewWarning =
  | 'manual_conflict_review_only'
  | 'localStorage_remains_fallback'
  | 'no_automatic_conflict_choice'
  | 'no_download_performed'
  | 'no_auto_apply'
  | 'no_new_upload_performed'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase21gRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21gConflictReviewSummary = {
  conflictDetected: boolean;
  selectedResolution: Phase21gConflictResolutionChoice;
  keepLocalLabel: '保留本地';
  useCloudLabel: '使用云端';
  localSnapshotHash: string | null;
  cloudSnapshotHash: string | null;
  receiptSourceSnapshotHash: string | null;
  cloudReadAfterUploadVerified: boolean;
  localParityVerified: boolean;
  uploadReceiptVerified: boolean;
};

export type Phase21gConflictReviewInput<TAppData = AppData> = {
  enabled?: boolean;
  parityCheck?: Phase21fCloudParityCheckResult<TAppData> | null;
  reviewOpened?: boolean;
  selectedResolution?: Exclude<Phase21gConflictResolutionChoice, 'none'> | null;
  explicitResolutionConfirmation?: boolean;
  localStorageFallbackConfirmed?: boolean;
  noAutoApplyConfirmed?: boolean;
  backupStillAvailableConfirmed?: boolean;
  ownerValidated?: boolean;
  schemaValidated?: boolean;
  automaticResolutionAttempted?: boolean;
  runtimeBoundary?: Partial<Phase21gRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  reviewId?: string;
};

export type Phase21gConflictReviewResult<TAppData = AppData> = {
  id: string;
  baseId: typeof PHASE21G_CONFLICT_REVIEW_ID;
  phase: '21G';
  ok: boolean;
  status: Phase21gConflictReviewStatus;
  readyFor21H: boolean;
  blockers: Phase21gConflictReviewBlocker[];
  warnings: Phase21gConflictReviewWarning[];
  userMessage: '发现冲突' | '同步完成' | '查看后再继续';
  conflictReview: Phase21gConflictReviewSummary;
  resolutionCandidate: ManualConflictResolutionResult | null;
  conflictDetected: boolean;
  conflictReviewVisible: boolean;
  manualResolutionRequired: boolean;
  manualResolutionConfirmed: boolean;
  automaticConflictDecisionMade: false;
  keepLocalAvailable: boolean;
  useCloudAvailable: boolean;
  keepLocalChosen: boolean;
  useCloudChosen: boolean;
  noConflictDetected: boolean;
  firstUploadPreviouslyPerformed: boolean;
  cloudReadAttempted: boolean;
  cloudReadAfterUploadVerified: boolean;
  localParityVerified: boolean;
  uploadReceiptVerified: boolean;
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
  localStorageFallbackPreserved: true;
  requiresOfflineRollbackBeforeProduction: true;
  nextPhase: '21H - Offline Rollback V1';
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
  blockers: Phase21gConflictReviewBlocker[],
  boundary: Partial<Phase21gRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21gConflictReviewBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21gConflictReviewBlocker[],
): Phase21gConflictReviewStatus => {
  if (blockers.includes('review_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('phase21f_not_ready') || blockers.includes('cloud_parity_missing')) {
    return 'phase21f_not_ready';
  }
  if (blockers.includes('conflict_review_missing')) return 'review_required';
  if (
    blockers.includes('resolution_choice_missing') ||
    blockers.includes('automatic_conflict_decision_attempted')
  ) {
    return 'resolution_missing';
  }
  if (
    blockers.includes('explicit_resolution_confirmation_missing') ||
    blockers.includes('localStorage_fallback_not_confirmed') ||
    blockers.includes('no_auto_apply_not_confirmed')
  ) {
    return 'confirmation_missing';
  }
  if (blockers.includes('backup_still_available_not_confirmed')) return 'backup_required';
  if (
    blockers.includes('owner_validation_missing') ||
    blockers.includes('schema_validation_missing')
  ) {
    return 'validation_missing';
  }
  if (blockers.includes('resolution_candidate_aborted')) return 'resolution_missing';
  return 'conflict_reviewed';
};

const parityReadyForReview = <TAppData>(
  parityCheck: Phase21fCloudParityCheckResult<TAppData> | null | undefined,
) =>
  parityCheck?.readyFor21G === true ||
  (
    parityCheck?.conflictReviewRequired === true &&
    parityCheck.cloudReadAttempted === true &&
    parityCheck.firstUploadPreviouslyPerformed === true
  );

const conflictDetectedFromParity = <TAppData>(
  parityCheck: Phase21fCloudParityCheckResult<TAppData> | null | undefined,
) => parityCheck?.conflictReviewRequired === true || parityCheck?.status === 'parity_mismatch';

const buildReviewSummary = <TAppData>(
  parityCheck: Phase21fCloudParityCheckResult<TAppData> | null | undefined,
  selectedResolution: Phase21gConflictResolutionChoice,
): Phase21gConflictReviewSummary => ({
  conflictDetected: conflictDetectedFromParity(parityCheck),
  selectedResolution,
  keepLocalLabel: '保留本地',
  useCloudLabel: '使用云端',
  localSnapshotHash: parityCheck?.parity.localSnapshotHash ?? null,
  cloudSnapshotHash: parityCheck?.parity.cloudAppDataHash ?? parityCheck?.parity.cloudMetadataHash ?? null,
  receiptSourceSnapshotHash: parityCheck?.parity.receiptSourceSnapshotHash ?? null,
  cloudReadAfterUploadVerified: parityCheck?.cloudReadAfterUploadVerified === true,
  localParityVerified: parityCheck?.localParityVerified === true,
  uploadReceiptVerified: parityCheck?.uploadReceiptVerified === true,
});

const resolutionActionFromChoice = (
  choice: Exclude<Phase21gConflictResolutionChoice, 'none'>,
) => (choice === 'keep_local' ? 'keep_local' : 'keep_cloud');

export const buildConflictReview = <TAppData = AppData>(
  input: Phase21gConflictReviewInput<TAppData> = {},
): Phase21gConflictReviewResult<TAppData> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21gConflictReviewBlocker[] = [];
  const warnings: Phase21gConflictReviewWarning[] = [
    'manual_conflict_review_only',
    'localStorage_remains_fallback',
    'no_automatic_conflict_choice',
    'no_download_performed',
    'no_auto_apply',
    'no_new_upload_performed',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'review_disabled');
  if (!input.parityCheck) addUnique(blockers, 'cloud_parity_missing');
  if (!parityReadyForReview(input.parityCheck)) addUnique(blockers, 'phase21f_not_ready');
  if (input.localStorageFallbackConfirmed !== true) {
    addUnique(blockers, 'localStorage_fallback_not_confirmed');
  }
  if (input.noAutoApplyConfirmed !== true) addUnique(blockers, 'no_auto_apply_not_confirmed');
  if (input.automaticResolutionAttempted === true) {
    addUnique(blockers, 'automatic_conflict_decision_attempted');
  }
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const conflictDetected = conflictDetectedFromParity(input.parityCheck);
  const selectedResolution: Phase21gConflictResolutionChoice = conflictDetected
    ? input.selectedResolution ?? 'none'
    : 'none';

  if (conflictDetected && input.reviewOpened !== true) addUnique(blockers, 'conflict_review_missing');
  if (conflictDetected && selectedResolution === 'none') addUnique(blockers, 'resolution_choice_missing');
  if (conflictDetected && input.explicitResolutionConfirmation !== true) {
    addUnique(blockers, 'explicit_resolution_confirmation_missing');
  }
  if (conflictDetected && selectedResolution === 'use_cloud' && input.backupStillAvailableConfirmed !== true) {
    addUnique(blockers, 'backup_still_available_not_confirmed');
  }
  if (conflictDetected && input.ownerValidated !== true) addUnique(blockers, 'owner_validation_missing');
  if (conflictDetected && input.schemaValidated !== true) addUnique(blockers, 'schema_validation_missing');

  let resolutionCandidate: ManualConflictResolutionResult | null = null;
  if (conflictDetected && selectedResolution !== 'none') {
    resolutionCandidate = runManualConflictResolutionCandidate({
      action: resolutionActionFromChoice(selectedResolution),
      confirmed: input.explicitResolutionConfirmation,
      backupAvailable: input.backupStillAvailableConfirmed,
      backupCreated: input.backupStillAvailableConfirmed,
      ownerValidated: input.ownerValidated,
      schemaValidated: input.schemaValidated,
    });

    if (resolutionCandidate.aborted) addUnique(blockers, 'resolution_candidate_aborted');
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'conflict_reviewed';
  const conflictReviewVisible = conflictDetected && input.reviewOpened === true;
  const firstUploadPreviouslyPerformed = input.parityCheck?.firstUploadPreviouslyPerformed === true;

  return {
    id: input.reviewId ?? `${PHASE21G_CONFLICT_REVIEW_ID}-${hashText(createdAt)}`,
    baseId: PHASE21G_CONFLICT_REVIEW_ID,
    phase: '21G',
    ok,
    status,
    readyFor21H: ok,
    blockers,
    warnings,
    userMessage: conflictDetected ? '发现冲突' : ok ? '同步完成' : '查看后再继续',
    conflictReview: buildReviewSummary(input.parityCheck, selectedResolution),
    resolutionCandidate,
    conflictDetected,
    conflictReviewVisible,
    manualResolutionRequired: conflictDetected,
    manualResolutionConfirmed: ok && conflictDetected,
    automaticConflictDecisionMade: false,
    keepLocalAvailable: conflictReviewVisible,
    useCloudAvailable: conflictReviewVisible,
    keepLocalChosen: selectedResolution === 'keep_local' && ok,
    useCloudChosen: selectedResolution === 'use_cloud' && ok,
    noConflictDetected: !conflictDetected && input.parityCheck?.ok === true,
    firstUploadPreviouslyPerformed,
    cloudReadAttempted: input.parityCheck?.cloudReadAttempted === true,
    cloudReadAfterUploadVerified: input.parityCheck?.cloudReadAfterUploadVerified === true,
    localParityVerified: input.parityCheck?.localParityVerified === true,
    uploadReceiptVerified: input.parityCheck?.uploadReceiptVerified === true,
    decisionApplied: false,
    newUploadPerformed: false,
    cloudWriteAttempted: false,
    uploadPerformed: false,
    cloudDataChanged: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    syncRuntimeEnabled:
      input.parityCheck?.syncRuntimeEnabled === true &&
      !blockers.includes('phase21f_not_ready') &&
      !blockers.includes('cloud_parity_missing') &&
      !hasRuntimeBoundaryBlocker(blockers),
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    requiresOfflineRollbackBeforeProduction: true,
    nextPhase: '21H - Offline Rollback V1',
    createdAt,
  };
};
