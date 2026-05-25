import {
  buildPhase19hCloudWriteShadowMode,
  type Phase19hCloudWriteShadowOwner,
  type Phase19hCloudWriteShadowResult,
} from './cloudWriteShadowMode';
import type { CloudOperationJournalEntry } from './cloudOperationJournal';
import type { Phase21bLocalBackupDryRunUiResult } from './localBackupDryRunUi';
import type { AppData } from '../models/training-model';

export const PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID =
  'phase21c-cloud-write-shadow-candidate';

export type Phase21cCloudWriteShadowCandidateStatus =
  | 'disabled'
  | 'phase21b_not_ready'
  | 'explicit_confirmation_missing'
  | 'schema_invalid'
  | 'cloud_conflict'
  | 'runtime_boundary_unsafe'
  | 'duplicate_shadow_candidate'
  | 'shadow_rejected'
  | 'shadow_candidate_ready';

export type Phase21cCloudWriteShadowCandidateBlocker =
  | 'candidate_disabled'
  | 'phase21b_not_ready'
  | 'backup_missing'
  | 'dry_run_missing'
  | 'appdata_missing'
  | 'owner_missing'
  | 'explicit_shadow_confirmation_missing'
  | 'schema_invalid'
  | 'cloud_conflict_detected'
  | 'duplicate_shadow_candidate'
  | 'shadow_rejected'
  | 'sync_runtime_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21cCloudWriteShadowCandidateWarning =
  | 'shadow_candidate_only'
  | 'first_upload_confirmation_still_required'
  | 'cloud_read_mirror_still_required'
  | 'localStorage_remains_fallback'
  | 'no_upload_performed'
  | 'no_cloud_write_performed'
  | 'no_auto_apply'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase21cRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21cShadowCandidateSummary = {
  operationId: string | null;
  requestFingerprint: string | null;
  cloudIdempotencyKey: string | null;
  accountId: string | null;
  ownerUserId: string | null;
  sourceSnapshotHash: string | null;
  targetSnapshotHash: string | null;
  schemaVersion: number | null;
  createdAt: string;
};

export type Phase21cCloudWriteShadowCandidateInput<TAppData = AppData> = {
  enabled?: boolean;
  localBackupDryRunUi?: Phase21bLocalBackupDryRunUiResult | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  explicitShadowConfirmation?: boolean;
  cloudConflictDetected?: boolean;
  existingJournalEntries?: CloudOperationJournalEntry[];
  runtimeBoundary?: Partial<Phase21cRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  operationId?: string;
  requestFingerprint?: string;
  candidateId?: string;
};

export type Phase21cCloudWriteShadowCandidateResult = {
  id: string;
  baseId: typeof PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID;
  phase: '21C';
  ok: boolean;
  status: Phase21cCloudWriteShadowCandidateStatus;
  readyFor21D: boolean;
  blockers: Phase21cCloudWriteShadowCandidateBlocker[];
  warnings: Phase21cCloudWriteShadowCandidateWarning[];
  userMessage: '查看后再继续';
  shadowCandidateReady: boolean;
  shadowCandidateAccepted: boolean;
  inMemoryShadowCandidateOnly: true;
  inMemoryShadowWriteAttempted: boolean;
  cloudWriteAttempted: false;
  cloudReadAttempted: false;
  shadowVerification: Phase19hCloudWriteShadowResult | null;
  shadowCandidate: Phase21cShadowCandidateSummary;
  requiresExplicitShadowConfirmation: true;
  requiresFirstUploadExplicitApply: true;
  requiresCloudReadMirrorBeforeApply: true;
  requiresConflictReviewBeforeApply: true;
  syncRuntimeEnabled: false;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: true;
  nextPhase: '21D - Cloud Read Mirror Verification V1';
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

const ownerFrom21b = (
  localBackupDryRunUi: Phase21bLocalBackupDryRunUiResult | null | undefined,
): Phase19hCloudWriteShadowOwner | null => {
  const account = localBackupDryRunUi?.accountInventory.accountCandidate;
  if (!account?.accountId || !account.ownerUserId) return null;

  return {
    scope: 'cloud-account-candidate',
    ownerId: account.ownerUserId,
    accountId: account.accountId,
    ...(account.deviceId ? { deviceId: account.deviceId } : {}),
  };
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase21cCloudWriteShadowCandidateBlocker[],
  boundary: Partial<Phase21cRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21cCloudWriteShadowCandidateBlocker[]) =>
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
  blockers: Phase21cCloudWriteShadowCandidateBlocker[],
): Phase21cCloudWriteShadowCandidateStatus => {
  if (blockers.includes('candidate_disabled')) return 'disabled';
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (
    blockers.includes('phase21b_not_ready') ||
    blockers.includes('backup_missing') ||
    blockers.includes('dry_run_missing') ||
    blockers.includes('appdata_missing') ||
    blockers.includes('owner_missing')
  ) {
    return 'phase21b_not_ready';
  }
  if (blockers.includes('explicit_shadow_confirmation_missing')) return 'explicit_confirmation_missing';
  if (blockers.includes('schema_invalid')) return 'schema_invalid';
  if (blockers.includes('cloud_conflict_detected')) return 'cloud_conflict';
  if (blockers.includes('duplicate_shadow_candidate')) return 'duplicate_shadow_candidate';
  if (blockers.includes('shadow_rejected')) return 'shadow_rejected';
  return 'shadow_candidate_ready';
};

const emptyShadowCandidate = (createdAt: string): Phase21cShadowCandidateSummary => ({
  operationId: null,
  requestFingerprint: null,
  cloudIdempotencyKey: null,
  accountId: null,
  ownerUserId: null,
  sourceSnapshotHash: null,
  targetSnapshotHash: null,
  schemaVersion: null,
  createdAt,
});

export const buildCloudWriteShadowCandidate = <TAppData = AppData>(
  input: Phase21cCloudWriteShadowCandidateInput<TAppData> = {},
): Phase21cCloudWriteShadowCandidateResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21cCloudWriteShadowCandidateBlocker[] = [];
  const warnings: Phase21cCloudWriteShadowCandidateWarning[] = [
    'shadow_candidate_only',
    'first_upload_confirmation_still_required',
    'cloud_read_mirror_still_required',
    'localStorage_remains_fallback',
    'no_upload_performed',
    'no_cloud_write_performed',
    'no_auto_apply',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'candidate_disabled');
  if (input.localBackupDryRunUi?.readyFor21C !== true || input.localBackupDryRunUi.ok !== true) {
    addUnique(blockers, 'phase21b_not_ready');
  }
  if (input.localBackupDryRunUi?.backupReady !== true || input.localBackupDryRunUi?.backup.status !== 'valid') {
    addUnique(blockers, 'backup_missing');
  }
  if (input.localBackupDryRunUi?.dryRunReady !== true) addUnique(blockers, 'dry_run_missing');
  if (input.appData == null) addUnique(blockers, 'appdata_missing');
  if (input.explicitShadowConfirmation !== true) {
    addUnique(blockers, 'explicit_shadow_confirmation_missing');
  }
  if (input.cloudConflictDetected === true) addUnique(blockers, 'cloud_conflict_detected');
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const owner = ownerFrom21b(input.localBackupDryRunUi);
  if (!owner) addUnique(blockers, 'owner_missing');

  const localSummary = input.localBackupDryRunUi?.accountInventory.appDataSummary ?? null;
  const sourceSnapshotHash = localSummary?.sourceSnapshotHash ?? null;
  const operationId = input.operationId ??
    (sourceSnapshotHash ? `phase21c-shadow-${sourceSnapshotHash}-${hashText(createdAt)}` : null);
  const requestFingerprint = input.requestFingerprint ??
    (owner && sourceSnapshotHash ? `${owner.accountId}:${sourceSnapshotHash}:${localSummary?.schemaVersion ?? 'unknown'}` : null);

  const schemaValid =
    input.appData != null &&
    (input.schemaValidator ? input.schemaValidator(input.appData) !== false : true);
  if (input.appData != null && schemaValid !== true) addUnique(blockers, 'schema_invalid');

  let shadowVerification: Phase19hCloudWriteShadowResult | null = null;
  if (
    blockers.length === 0 &&
    input.appData != null &&
    owner &&
    sourceSnapshotHash &&
    operationId &&
    requestFingerprint
  ) {
    shadowVerification = buildPhase19hCloudWriteShadowMode({
      enabled: true,
      explicitShadowOptIn: true,
      manualConfirmation: input.explicitShadowConfirmation,
      dryRunPassed: input.localBackupDryRunUi?.dryRunReady,
      backupAvailable: input.localBackupDryRunUi?.backup.status === 'valid',
      expectedOwner: owner,
      sourceOwner: owner,
      appData: input.appData,
      schemaValidator: input.schemaValidator,
      cloudConflictDetected: false,
      operationId,
      requestFingerprint,
      sourceSnapshotHash,
      targetSnapshotHash: sourceSnapshotHash,
      nowIso: createdAt,
      existingJournalEntries: input.existingJournalEntries,
      shadowAdapter: () => ({
        ok: true,
        rollbackAvailable: true,
        message: 'Shadow candidate accepted without cloud write.',
      }),
    });

    if (shadowVerification.blockers.includes('duplicate_shadow')) {
      addUnique(blockers, 'duplicate_shadow_candidate');
    }
    if (!shadowVerification.ok && !shadowVerification.blockers.includes('duplicate_shadow')) {
      addUnique(blockers, 'shadow_rejected');
    }
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'shadow_candidate_ready';
  const shadowCandidate: Phase21cShadowCandidateSummary = owner && sourceSnapshotHash && operationId && requestFingerprint
    ? {
        operationId,
        requestFingerprint,
        cloudIdempotencyKey: shadowVerification?.journalEntry?.cloudIdempotencyKey ?? null,
        accountId: owner.accountId ?? null,
        ownerUserId: owner.ownerId,
        sourceSnapshotHash,
        targetSnapshotHash: sourceSnapshotHash,
        schemaVersion: localSummary?.schemaVersion ?? null,
        createdAt,
      }
    : emptyShadowCandidate(createdAt);

  return {
    id: input.candidateId ?? `${PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID}-${hashText(createdAt)}`,
    baseId: PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID,
    phase: '21C',
    ok,
    status,
    readyFor21D: ok,
    blockers,
    warnings,
    userMessage: '查看后再继续',
    shadowCandidateReady: ok,
    shadowCandidateAccepted: shadowVerification?.status === 'accepted_shadow' && ok,
    inMemoryShadowCandidateOnly: true,
    inMemoryShadowWriteAttempted: shadowVerification?.shadowWriteAttempted ?? false,
    cloudWriteAttempted: false,
    cloudReadAttempted: false,
    shadowVerification,
    shadowCandidate,
    requiresExplicitShadowConfirmation: true,
    requiresFirstUploadExplicitApply: true,
    requiresCloudReadMirrorBeforeApply: true,
    requiresConflictReviewBeforeApply: true,
    syncRuntimeEnabled: false,
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    nextPhase: '21D - Cloud Read Mirror Verification V1',
    createdAt,
  };
};
