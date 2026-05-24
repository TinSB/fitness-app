import {
  CLOUD_PUSH_STATUS_FIELD,
  runCloudPushCandidate,
  type CloudPushOwner,
} from './cloudPushCandidate';
import {
  checkDuplicateManualCloudOperationCandidate,
  createCloudOperationJournalEntry,
  type CloudOperationJournalEntry,
} from './cloudOperationJournal';

export const PHASE19H_CLOUD_WRITE_SHADOW_ID = 'phase19h-cloud-write-shadow-mode';

export type Phase19hCloudWriteShadowOwner = CloudPushOwner;

export type Phase19hCloudWriteShadowStatus =
  | 'disabled'
  | 'manual_confirmation_missing'
  | 'dry_run_missing'
  | 'backup_missing'
  | 'owner_mismatch'
  | 'cloud_conflict'
  | 'schema_invalid'
  | 'shadow_adapter_unavailable'
  | 'duplicate_shadow'
  | 'shadow_write_rejected'
  | 'accepted_shadow';

export type Phase19hCloudWriteShadowBlockerCode =
  | 'write_shadow_disabled'
  | 'manual_confirmation_missing'
  | 'dry_run_missing'
  | 'backup_missing'
  | 'owner_mismatch'
  | 'cloud_conflict'
  | 'schema_invalid'
  | 'shadow_adapter_unavailable'
  | 'duplicate_shadow'
  | 'shadow_write_rejected';

export type Phase19hCloudWriteShadowAdapterResult = {
  ok: boolean;
  rollbackAvailable?: boolean;
  message?: string;
};

export type Phase19hCloudWriteShadowInput<TAppData = unknown> = {
  enabled?: boolean;
  explicitShadowOptIn?: boolean;
  manualConfirmation?: boolean;
  dryRunPassed?: boolean;
  backupAvailable?: boolean;
  expectedOwner?: Phase19hCloudWriteShadowOwner | null;
  sourceOwner?: Phase19hCloudWriteShadowOwner | null;
  appData?: TAppData | null;
  schemaValidator?: (appData: TAppData) => boolean;
  cloudConflictDetected?: boolean;
  operationId?: string;
  requestFingerprint?: string;
  sourceSnapshotHash?: string;
  targetSnapshotHash?: string;
  nowIso?: string;
  existingJournalEntries?: CloudOperationJournalEntry[];
  shadowAdapter?: ((appData: TAppData) => Phase19hCloudWriteShadowAdapterResult) | null;
};

export type Phase19hCloudWriteShadowResult = {
  id: typeof PHASE19H_CLOUD_WRITE_SHADOW_ID;
  phase: '19H';
  ok: boolean;
  noFakeSuccess: true;
  status: Phase19hCloudWriteShadowStatus;
  blockers: Phase19hCloudWriteShadowBlockerCode[];
  journalEntry: CloudOperationJournalEntry | null;
  duplicateOperationId: string | null;
  shadowWriteAttempted: boolean;
  rollbackAvailable: boolean;
  applied: false;
  localDataChanged: false;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  cloudPrimaryChanged: false;
  message: string;
};

const result = (
  status: Phase19hCloudWriteShadowStatus,
  message: string,
  options: {
    ok?: boolean;
    blockers?: Phase19hCloudWriteShadowBlockerCode[];
    journalEntry?: CloudOperationJournalEntry | null;
    duplicateOperationId?: string | null;
    shadowWriteAttempted?: boolean;
    rollbackAvailable?: boolean;
  } = {},
): Phase19hCloudWriteShadowResult => ({
  id: PHASE19H_CLOUD_WRITE_SHADOW_ID,
  phase: '19H',
  ok: options.ok ?? false,
  noFakeSuccess: true,
  status,
  blockers: options.blockers ?? [],
  journalEntry: options.journalEntry ?? null,
  duplicateOperationId: options.duplicateOperationId ?? null,
  shadowWriteAttempted: options.shadowWriteAttempted ?? false,
  rollbackAvailable: options.rollbackAvailable ?? false,
  applied: false,
  localDataChanged: false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  cloudPrimaryChanged: false,
  message,
});

const toJournalOwner = (owner: Phase19hCloudWriteShadowOwner) => ({
  scope: owner.scope,
  ownerId: owner.ownerId,
  ...(owner.accountId ? { accountId: owner.accountId } : {}),
});

const canBuildJournalEntry = <TAppData>(input: Phase19hCloudWriteShadowInput<TAppData>) =>
  !!input.operationId &&
  !!input.requestFingerprint &&
  !!input.sourceSnapshotHash &&
  !!input.targetSnapshotHash &&
  !!input.sourceOwner?.scope &&
  !!input.sourceOwner.ownerId;

const buildJournalEntry = <TAppData>(
  input: Phase19hCloudWriteShadowInput<TAppData>,
  status: CloudOperationJournalEntry['status'],
  errorCode: string | null = null,
): CloudOperationJournalEntry | null => {
  if (!canBuildJournalEntry(input) || !input.sourceOwner) return null;
  const createdAt = input.nowIso ?? new Date(0).toISOString();
  return createCloudOperationJournalEntry({
    operationId: input.operationId as string,
    operationType: 'manual_push_candidate',
    ownerScope: toJournalOwner(input.sourceOwner),
    requestFingerprint: input.requestFingerprint as string,
    sourceSnapshotHash: input.sourceSnapshotHash as string,
    targetSnapshotHash: input.targetSnapshotHash as string,
    status,
    createdAt,
    completedAt: null,
    errorCode,
  });
};

const mapPushStatus = (status: ReturnType<typeof runCloudPushCandidate>[typeof CLOUD_PUSH_STATUS_FIELD]) => {
  switch (status) {
    case 'manual_confirmation_missing':
      return { status: 'manual_confirmation_missing' as const, blocker: 'manual_confirmation_missing' as const };
    case 'dry_run_missing':
      return { status: 'dry_run_missing' as const, blocker: 'dry_run_missing' as const };
    case 'backup_missing':
      return { status: 'backup_missing' as const, blocker: 'backup_missing' as const };
    case 'owner_mismatch':
      return { status: 'owner_mismatch' as const, blocker: 'owner_mismatch' as const };
    case 'cloud_conflict':
      return { status: 'cloud_conflict' as const, blocker: 'cloud_conflict' as const };
    case 'schema_invalid':
      return { status: 'schema_invalid' as const, blocker: 'schema_invalid' as const };
    case 'write_rejected':
      return { status: 'shadow_write_rejected' as const, blocker: 'shadow_write_rejected' as const };
    default:
      return { status: 'disabled' as const, blocker: 'write_shadow_disabled' as const };
  }
};

export const buildPhase19hCloudWriteShadowMode = <TAppData = unknown>(
  input: Phase19hCloudWriteShadowInput<TAppData> = {},
): Phase19hCloudWriteShadowResult => {
  if (input.enabled !== true || input.explicitShadowOptIn !== true) {
    return result('disabled', 'Cloud write shadow mode is disabled by default.', {
      blockers: ['write_shadow_disabled'],
    });
  }

  if (!input.shadowAdapter) {
    const preflight = runCloudPushCandidate({
      enabled: true,
      explicitOptIn: true,
      manualConfirmation: input.manualConfirmation,
      dryRunPassed: input.dryRunPassed,
      expectedOwner: input.expectedOwner,
      sourceOwner: input.sourceOwner,
      backupAvailable: input.backupAvailable,
      schemaValidator: input.schemaValidator,
      appData: input.appData,
      cloudConflictDetected: input.cloudConflictDetected,
      writeAdapter: null,
    });
    const mapped = mapPushStatus(preflight[CLOUD_PUSH_STATUS_FIELD]);
    if (mapped.status !== 'shadow_write_rejected') {
      return result(mapped.status, preflight.message, { blockers: [mapped.blocker] });
    }
    return result('shadow_write_rejected', preflight.message, {
      blockers: ['shadow_adapter_unavailable'],
    });
  }

  const candidateJournalEntry = buildJournalEntry(input, 'accepted_candidate');
  if (candidateJournalEntry) {
    const duplicate = checkDuplicateManualCloudOperationCandidate(
      input.existingJournalEntries ?? [],
      candidateJournalEntry,
    );
    if (duplicate.duplicate) {
      return result('duplicate_shadow', 'Duplicate cloud write shadow candidate blocked.', {
        blockers: ['duplicate_shadow'],
        duplicateOperationId: duplicate.existingOperationId,
      });
    }
  }

  let shadowWriteAttempted = false;
  const pushResult = runCloudPushCandidate({
    enabled: true,
    explicitOptIn: true,
    manualConfirmation: input.manualConfirmation,
    dryRunPassed: input.dryRunPassed,
    expectedOwner: input.expectedOwner,
    sourceOwner: input.sourceOwner,
    backupAvailable: input.backupAvailable,
    schemaValidator: input.schemaValidator,
    appData: input.appData,
    cloudConflictDetected: input.cloudConflictDetected,
    writeAdapter: (appData) => {
      shadowWriteAttempted = true;
      return input.shadowAdapter ? input.shadowAdapter(appData) : { ok: false };
    },
  });

  if (pushResult.ok && pushResult[CLOUD_PUSH_STATUS_FIELD] === 'write_candidate_success') {
    return result('accepted_shadow', pushResult.message, {
      ok: true,
      journalEntry: candidateJournalEntry,
      shadowWriteAttempted,
      rollbackAvailable: pushResult.rollbackAvailable,
    });
  }

  const mapped = mapPushStatus(pushResult[CLOUD_PUSH_STATUS_FIELD]);
  return result(mapped.status, pushResult.message, {
    blockers: [mapped.blocker],
    journalEntry: shadowWriteAttempted ? buildJournalEntry(input, 'failed', mapped.blocker) : null,
    shadowWriteAttempted,
    rollbackAvailable: pushResult.rollbackAvailable,
  });
};
