export const PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID =
  'phase19j-explicit-opt-in-single-user-sync-candidate';

export type Phase19jExplicitOptInSyncCandidateStatus =
  | 'disabled'
  | 'opt_in_missing'
  | 'manual_confirmation_missing'
  | 'account_not_ready'
  | 'migration_dry_run_missing'
  | 'backup_missing'
  | 'cloud_unavailable'
  | 'owner_not_verified'
  | 'schema_not_verified'
  | 'shadow_candidate_missing'
  | 'conflict_review_required'
  | 'rollback_unavailable'
  | 'offline_unavailable'
  | 'candidate_ready';

export type Phase19jExplicitOptInSyncCandidateBlocker =
  | 'sync_disabled'
  | 'explicit_opt_in_missing'
  | 'manual_confirmation_missing'
  | 'account_not_ready'
  | 'migration_dry_run_not_ready'
  | 'backup_missing'
  | 'cloud_unavailable'
  | 'owner_not_verified'
  | 'schema_not_verified'
  | 'shadow_candidate_missing'
  | 'conflict_review_required'
  | 'rollback_unavailable'
  | 'offline_unavailable';

export type Phase19jExplicitOptInSyncCandidateWarning =
  | 'manual_sync_only'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled'
  | 'no_background_sync'
  | 'review_before_final_step';

export type Phase19jMigrationDryRunLike = {
  readyForShadowCandidate: boolean;
  noUpload: true;
  noDownload: true;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  blockers?: string[];
};

export type Phase19jReadMirrorLike = {
  status:
    | 'disabled'
    | 'account_not_ready'
    | 'repository_unavailable'
    | 'cloud_missing'
    | 'rejected'
    | 'review_required'
    | 'mirrored';
  requiresManualReview: boolean;
  applied: false;
  localDataChanged: false;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
};

export type Phase19jWriteShadowLike = {
  ok: boolean;
  status: string;
  shadowWriteAttempted: boolean;
  localDataChanged: false;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  cloudPrimaryChanged: false;
};

export type Phase19jConflictPreflightLike = {
  conflictDetected?: boolean;
  manualResolutionRequired?: boolean;
  severity?: 'info' | 'warning' | 'blocking';
  conflictType?: string | null;
};

export type Phase19jExplicitOptInSyncCandidateInput = {
  enabled?: boolean;
  explicitOptIn?: boolean;
  manualConfirmation?: boolean;
  accountReady?: boolean;
  backupAvailable?: boolean;
  cloudAvailable?: boolean;
  ownerVerified?: boolean;
  schemaVerified?: boolean;
  rollbackAvailable?: boolean;
  offlineTrainingAvailable?: boolean;
  migrationDryRun?: Phase19jMigrationDryRunLike | null;
  readMirror?: Phase19jReadMirrorLike | null;
  writeShadow?: Phase19jWriteShadowLike | null;
  conflictPreflight?: Phase19jConflictPreflightLike | null;
  manualConflictReviewed?: boolean;
  nowIso?: string;
  syncCandidateId?: string;
};

export type Phase19jExplicitOptInSyncCandidate = {
  syncMode: 'manual_explicit_opt_in';
  dryRunReady: boolean;
  shadowAccepted: boolean;
  readMirrorStatus: Phase19jReadMirrorLike['status'] | 'not_checked';
  writeShadowStatus: string | 'missing';
  conflictType: string | null;
  conflictReviewed: boolean;
  rollbackAvailable: boolean;
  requiresSeparateApplyStep: true;
  nextReview: '19K - Conflict / Offline / Rollback Acceptance V1';
};

export type Phase19jExplicitOptInSyncCandidateResult = {
  id: string;
  baseId: typeof PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID;
  phase: '19J';
  ok: boolean;
  status: Phase19jExplicitOptInSyncCandidateStatus;
  readyForManualSyncCandidate: boolean;
  requiresManualConflictReview: boolean;
  blockers: Phase19jExplicitOptInSyncCandidateBlocker[];
  warnings: Phase19jExplicitOptInSyncCandidateWarning[];
  candidate: Phase19jExplicitOptInSyncCandidate;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  noAutomaticWorker: true;
  localStorageFallbackPreserved: true;
  offlineTrainingAvailable: boolean;
  nextPhase: '19K - Conflict / Offline / Rollback Acceptance V1';
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
  blockers: Phase19jExplicitOptInSyncCandidateBlocker[],
): Phase19jExplicitOptInSyncCandidateStatus => {
  if (blockers.includes('sync_disabled')) return 'disabled';
  if (blockers.includes('explicit_opt_in_missing')) return 'opt_in_missing';
  if (blockers.includes('manual_confirmation_missing')) return 'manual_confirmation_missing';
  if (blockers.includes('account_not_ready')) return 'account_not_ready';
  if (blockers.includes('migration_dry_run_not_ready')) return 'migration_dry_run_missing';
  if (blockers.includes('backup_missing')) return 'backup_missing';
  if (blockers.includes('cloud_unavailable')) return 'cloud_unavailable';
  if (blockers.includes('owner_not_verified')) return 'owner_not_verified';
  if (blockers.includes('schema_not_verified')) return 'schema_not_verified';
  if (blockers.includes('shadow_candidate_missing')) return 'shadow_candidate_missing';
  if (blockers.includes('conflict_review_required')) return 'conflict_review_required';
  if (blockers.includes('rollback_unavailable')) return 'rollback_unavailable';
  if (blockers.includes('offline_unavailable')) return 'offline_unavailable';
  return 'candidate_ready';
};

const hasUnreviewedConflict = (input: Phase19jExplicitOptInSyncCandidateInput): boolean => {
  const readReviewRequired =
    input.readMirror?.requiresManualReview === true ||
    input.readMirror?.status === 'review_required' ||
    input.readMirror?.status === 'rejected';
  const conflictReviewRequired =
    input.conflictPreflight?.conflictDetected === true ||
    input.conflictPreflight?.manualResolutionRequired === true ||
    input.conflictPreflight?.severity === 'blocking';

  return (readReviewRequired || conflictReviewRequired) && input.manualConflictReviewed !== true;
};

const buildCandidate = (
  input: Phase19jExplicitOptInSyncCandidateInput,
): Phase19jExplicitOptInSyncCandidate => ({
  syncMode: 'manual_explicit_opt_in',
  dryRunReady: input.migrationDryRun?.readyForShadowCandidate === true,
  shadowAccepted: input.writeShadow?.ok === true && input.writeShadow.status === 'accepted_shadow',
  readMirrorStatus: input.readMirror?.status ?? 'not_checked',
  writeShadowStatus: input.writeShadow?.status ?? 'missing',
  conflictType: input.conflictPreflight?.conflictType ?? null,
  conflictReviewed: input.manualConflictReviewed === true,
  rollbackAvailable: input.rollbackAvailable === true,
  requiresSeparateApplyStep: true,
  nextReview: '19K - Conflict / Offline / Rollback Acceptance V1',
});

export const buildPhase19jExplicitOptInSingleUserSyncCandidate = (
  input: Phase19jExplicitOptInSyncCandidateInput = {},
): Phase19jExplicitOptInSyncCandidateResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase19jExplicitOptInSyncCandidateBlocker[] = [];
  const warnings: Phase19jExplicitOptInSyncCandidateWarning[] = [
    'manual_sync_only',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
    'no_background_sync',
    'review_before_final_step',
  ];

  if (input.enabled !== true) addUnique(blockers, 'sync_disabled');
  if (input.explicitOptIn !== true) addUnique(blockers, 'explicit_opt_in_missing');
  if (input.manualConfirmation !== true) addUnique(blockers, 'manual_confirmation_missing');
  if (input.accountReady !== true) addUnique(blockers, 'account_not_ready');
  if (input.migrationDryRun?.readyForShadowCandidate !== true) {
    addUnique(blockers, 'migration_dry_run_not_ready');
  }
  if (input.backupAvailable !== true) addUnique(blockers, 'backup_missing');
  if (input.cloudAvailable !== true) addUnique(blockers, 'cloud_unavailable');
  if (input.ownerVerified !== true) addUnique(blockers, 'owner_not_verified');
  if (input.schemaVerified !== true) addUnique(blockers, 'schema_not_verified');
  if (input.writeShadow?.ok !== true || input.writeShadow.status !== 'accepted_shadow') {
    addUnique(blockers, 'shadow_candidate_missing');
  }
  if (hasUnreviewedConflict(input)) addUnique(blockers, 'conflict_review_required');
  if (input.rollbackAvailable !== true) addUnique(blockers, 'rollback_unavailable');
  if (input.offlineTrainingAvailable !== true) addUnique(blockers, 'offline_unavailable');

  const status = statusFromBlockers(blockers);
  const readyForManualSyncCandidate = status === 'candidate_ready';
  const candidate = buildCandidate(input);

  return {
    id: input.syncCandidateId ?? `${PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID}-${hashText(createdAt)}`,
    baseId: PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID,
    phase: '19J',
    ok: readyForManualSyncCandidate,
    status,
    readyForManualSyncCandidate,
    requiresManualConflictReview: blockers.includes('conflict_review_required'),
    blockers,
    warnings,
    candidate,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    noAutomaticWorker: true,
    localStorageFallbackPreserved: true,
    offlineTrainingAvailable: input.offlineTrainingAvailable === true,
    nextPhase: '19K - Conflict / Offline / Rollback Acceptance V1',
    createdAt,
  };
};
