import {
  buildPhase19gCloudReadMirror,
  type Phase19gCloudReadMirrorRepository,
  type Phase19gCloudReadMirrorResult,
} from './cloudReadMirror';
import {
  buildPhase19hCloudWriteShadowMode,
  type Phase19hCloudWriteShadowAdapterResult,
  type Phase19hCloudWriteShadowResult,
} from './cloudWriteShadowMode';
import type { CloudOperationJournalEntry } from './cloudOperationJournal';
import type { Phase20eLocalBackupDryRunResult } from './localBackupDryRunMigrationRuntimeFlow';

export const PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID =
  'phase20f-cloud-read-write-verification-flow';

export type Phase20fCloudReadWriteVerificationStatus =
  | 'disabled'
  | 'phase20e_not_ready'
  | 'manual_confirmation_missing'
  | 'read_verification_blocked'
  | 'manual_review_required'
  | 'write_verification_blocked'
  | 'verified';

export type Phase20fCloudReadWriteVerificationBlocker =
  | 'flow_disabled'
  | 'phase20e_not_ready'
  | 'appdata_missing'
  | 'verification_opt_in_missing'
  | 'manual_confirmation_missing'
  | 'read_repository_unavailable'
  | 'cloud_read_rejected'
  | 'cloud_read_manual_review'
  | 'write_adapter_unavailable'
  | 'write_shadow_rejected'
  | 'duplicate_write_candidate'
  | 'rollback_unavailable'
  | 'source_of_truth_changed'
  | 'localStorage_deleted'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled';

export type Phase20fCloudReadWriteVerificationWarning =
  | 'verification_only'
  | 'explicit_manual_flow'
  | 'localStorage_remains_fallback'
  | 'no_auto_apply'
  | 'cloud_primary_not_enabled'
  | 'no_default_or_background_sync';

export type Phase20fRuntimeBoundaryEvidence = {
  cloudPrimaryEnabled?: boolean;
  defaultSyncEnabled?: boolean;
  backgroundWorkEnabled?: boolean;
  sourceOfTruthChanged?: boolean;
  localStorageDeleted?: boolean;
};

export type Phase20fCloudReadWriteVerificationInput<TAppData = unknown> = {
  enabled?: boolean;
  localBackupDryRun?: Phase20eLocalBackupDryRunResult | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  readRepository?: Phase19gCloudReadMirrorRepository<TAppData> | null;
  writeShadowAdapter?: ((appData: TAppData) => Phase19hCloudWriteShadowAdapterResult) | null;
  explicitVerificationOptIn?: boolean;
  manualConfirmation?: boolean;
  existingJournalEntries?: CloudOperationJournalEntry[];
  runtimeBoundary?: Phase20fRuntimeBoundaryEvidence | null;
  nowIso?: string;
  operationId?: string;
  requestFingerprint?: string;
  verificationId?: string;
};

export type Phase20fCloudReadWriteVerificationResult<TAppData = unknown> = {
  id: string;
  baseId: typeof PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID;
  phase: '20F';
  ok: boolean;
  status: Phase20fCloudReadWriteVerificationStatus;
  readyFor20G: boolean;
  blockers: Phase20fCloudReadWriteVerificationBlocker[];
  warnings: Phase20fCloudReadWriteVerificationWarning[];
  userMessage: '查看后再继续';
  readVerification: Phase19gCloudReadMirrorResult<TAppData> | null;
  writeVerification: Phase19hCloudWriteShadowResult | null;
  cloudReadAttempted: boolean;
  cloudWriteAttempted: boolean;
  cloudWriteCandidateAccepted: boolean;
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
  localStorageFallbackPreserved: true;
  cloudPrimaryChanged: false;
  nextPhase: '20G - Conflict/Offline/Rollback Runtime Flow V1';
  createdAt: string;
};

type VerificationOwner = {
  scope: 'cloud-account-candidate';
  ownerId: string;
  accountId: string;
  deviceId?: string;
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

const ownerFromDryRun = (
  dryRun: Phase20eLocalBackupDryRunResult | null | undefined,
): VerificationOwner | null => {
  const account = dryRun?.accountInventory.accountCandidate;
  if (!account?.accountId || !account.ownerUserId) return null;
  return {
    scope: 'cloud-account-candidate',
    ownerId: account.ownerUserId,
    accountId: account.accountId,
    ...(account.deviceId ? { deviceId: account.deviceId } : {}),
  };
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20fCloudReadWriteVerificationBlocker[],
  boundary: Phase20fRuntimeBoundaryEvidence | null | undefined,
) => {
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addDryRunBlockers = (
  blockers: Phase20fCloudReadWriteVerificationBlocker[],
  dryRun: Phase20eLocalBackupDryRunResult | null | undefined,
) => {
  if (dryRun?.readyFor20F !== true || dryRun.ok !== true) {
    addUnique(blockers, 'phase20e_not_ready');
  }
};

const statusFromBlockers = (
  blockers: Phase20fCloudReadWriteVerificationBlocker[],
): Phase20fCloudReadWriteVerificationStatus => {
  if (blockers.includes('flow_disabled')) return 'disabled';
  if (blockers.includes('phase20e_not_ready') || blockers.includes('appdata_missing')) {
    return 'phase20e_not_ready';
  }
  if (
    blockers.includes('verification_opt_in_missing') ||
    blockers.includes('manual_confirmation_missing')
  ) {
    return 'manual_confirmation_missing';
  }
  if (
    blockers.includes('read_repository_unavailable') ||
    blockers.includes('cloud_read_rejected')
  ) {
    return 'read_verification_blocked';
  }
  if (blockers.includes('cloud_read_manual_review')) return 'manual_review_required';
  if (
    blockers.includes('write_adapter_unavailable') ||
    blockers.includes('write_shadow_rejected') ||
    blockers.includes('duplicate_write_candidate') ||
    blockers.includes('rollback_unavailable') ||
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('localStorage_deleted') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled')
  ) {
    return 'write_verification_blocked';
  }
  return 'verified';
};

const readIsSafeForWriteVerification = <TAppData>(
  readVerification: Phase19gCloudReadMirrorResult<TAppData>,
) => (
  readVerification.status === 'cloud_missing' ||
  readVerification.status === 'mirrored'
);

export const buildCloudReadWriteVerificationFlow = <TAppData = unknown>(
  input: Phase20fCloudReadWriteVerificationInput<TAppData> = {},
): Phase20fCloudReadWriteVerificationResult<TAppData> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20fCloudReadWriteVerificationBlocker[] = [];
  const warnings: Phase20fCloudReadWriteVerificationWarning[] = [
    'verification_only',
    'explicit_manual_flow',
    'localStorage_remains_fallback',
    'no_auto_apply',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ];

  if (input.enabled !== true) addUnique(blockers, 'flow_disabled');
  if (input.explicitVerificationOptIn !== true) addUnique(blockers, 'verification_opt_in_missing');
  if (input.manualConfirmation !== true) addUnique(blockers, 'manual_confirmation_missing');
  if (input.appData == null) addUnique(blockers, 'appdata_missing');
  addDryRunBlockers(blockers, input.localBackupDryRun);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const owner = ownerFromDryRun(input.localBackupDryRun);
  const localSummary = input.localBackupDryRun?.accountInventory.appDataSummary ?? null;
  const operationId = input.operationId ??
    `phase20f-cloud-verification-${localSummary?.sourceSnapshotHash ?? 'missing'}-${hashText(createdAt)}`;
  let readVerification: Phase19gCloudReadMirrorResult<TAppData> | null = null;
  let writeVerification: Phase19hCloudWriteShadowResult | null = null;

  const preflightBlocked = blockers.length > 0;
  if (!preflightBlocked) {
    if (!input.readRepository) {
      addUnique(blockers, 'read_repository_unavailable');
    } else {
      readVerification = buildPhase19gCloudReadMirror({
        enabled: true,
        accountReady: true,
        expectedOwner: owner,
        localSnapshot: {
          schemaVersion: localSummary?.schemaVersion != null ? String(localSummary.schemaVersion) : null,
          sourceSnapshotHash: localSummary?.sourceSnapshotHash ?? null,
          updatedAt: input.localBackupDryRun?.createdAt ?? null,
        },
        repository: input.readRepository,
        schemaValidator: input.schemaValidator,
      });

      if (readVerification.status === 'rejected') addUnique(blockers, 'cloud_read_rejected');
      if (readVerification.requiresManualReview && !readIsSafeForWriteVerification(readVerification)) {
        addUnique(blockers, 'cloud_read_manual_review');
      }
    }
  }

  if (blockers.length === 0 && readVerification && input.appData != null && owner && localSummary) {
    writeVerification = buildPhase19hCloudWriteShadowMode({
      enabled: true,
      explicitShadowOptIn: true,
      manualConfirmation: input.manualConfirmation,
      dryRunPassed: input.localBackupDryRun?.readyFor20F,
      backupAvailable: input.localBackupDryRun?.backup.status === 'valid',
      expectedOwner: owner,
      sourceOwner: owner,
      appData: input.appData,
      schemaValidator: input.schemaValidator,
      cloudConflictDetected: false,
      operationId,
      requestFingerprint: input.requestFingerprint ?? operationId,
      sourceSnapshotHash: localSummary.sourceSnapshotHash,
      targetSnapshotHash: localSummary.sourceSnapshotHash,
      nowIso: createdAt,
      existingJournalEntries: input.existingJournalEntries,
      shadowAdapter: input.writeShadowAdapter ?? null,
    });

    if (writeVerification.blockers.includes('shadow_adapter_unavailable')) {
      addUnique(blockers, 'write_adapter_unavailable');
    }
    if (writeVerification.blockers.includes('duplicate_shadow')) {
      addUnique(blockers, 'duplicate_write_candidate');
    }
    if (writeVerification.blockers.includes('shadow_write_rejected')) {
      addUnique(blockers, 'write_shadow_rejected');
    }
    if (!writeVerification.ok && blockers.length === 0) {
      addUnique(blockers, 'write_shadow_rejected');
    }
    if (writeVerification.ok && writeVerification.rollbackAvailable !== true) {
      addUnique(blockers, 'rollback_unavailable');
    }
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'verified';

  return {
    id: input.verificationId ?? `${PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID}-${hashText(createdAt)}`,
    baseId: PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID,
    phase: '20F',
    ok,
    status,
    readyFor20G: ok,
    blockers,
    warnings,
    userMessage: '查看后再继续',
    readVerification,
    writeVerification,
    cloudReadAttempted: readVerification !== null,
    cloudWriteAttempted: writeVerification?.shadowWriteAttempted ?? false,
    cloudWriteCandidateAccepted: writeVerification?.status === 'accepted_shadow',
    syncRuntimeEnabled: input.localBackupDryRun?.syncRuntimeEnabled === true && !blockers.includes('phase20e_not_ready'),
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
    localStorageFallbackPreserved: true,
    cloudPrimaryChanged: false,
    nextPhase: '20G - Conflict/Offline/Rollback Runtime Flow V1',
    createdAt,
  };
};
