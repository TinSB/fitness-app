import type { AppData } from '../models/training-model';
import {
  ensureCloudUploadEligible,
  type UploadEligibilityGuardResult,
} from '../dataHealth/uploadEligibilityGuard';
import { buildAppDataSnapshotHash } from './accountBoundaryLocalInventory';

export type CloudSubsequentUploadReason =
  | 'uploaded'
  | 'unchanged'
  | 'not_enabled'
  | 'pending_safe_repairs'
  | 'backup_failed'
  | 'partially_repaired'
  | 'missing_repair_receipt'
  | 'invalid_appdata'
  | 'cloud_conflict'
  | 'remote_changed'
  | 'remote_unavailable'
  | 'missing_expected_previous_snapshot'
  | 'cloud_unavailable'
  | 'upload_failed'
  | 'unknown';

export type CloudSubsequentUploadPassiveTone =
  | 'ok'
  | 'busy'
  | 'audit-pending'
  | 'backup-failed';

export interface CloudSubsequentUploadLocalSyncState {
  syncedAppDataHash: string | null;
  syncedOwnerUserId: string | null;
  syncedAt?: string | null;
}

export interface CloudSubsequentUploadCloudSnapshotMetadata {
  sourceSnapshotHash: string | null;
  cloudAppDataHash?: string | null;
  createdAt?: string | null;
}

export interface CloudSubsequentUploadGateway {
  writeSnapshot: (input: {
    appData: AppData;
    expectedPreviousHash: string | null;
    nextSnapshotHash: string;
    accountId: string | null;
    ownerUserId: string | null;
    nowIso: string;
  }) => Promise<{
    ok: boolean;
    snapshotId?: string | null;
    sourceSnapshotHash?: string | null;
    createdAt?: string | null;
    error?: string | null;
  }>;
  // V5 Cloud Optimistic Concurrency: optional fresh-read capability. When
  // provided, runCloudSubsequentUpload calls this immediately before
  // writeSnapshot and rejects with `remote_changed` / `remote_unavailable`
  // when the freshly-read cloud latest disagrees with the locally-known
  // expected previous snapshot hash. Optional so legacy callers that pass
  // a write-only gateway continue to compile; legacy callers fall back to
  // the V4 caller-supplied `lastCloudSnapshot` early-rejection check.
  readLatestSnapshot?: (input: {
    accountId: string | null;
    ownerUserId: string | null;
  }) => Promise<{
    ok: boolean;
    sourceSnapshotHash?: string | null;
    createdAt?: string | null;
    error?: string | null;
  }>;
}

export interface CloudSubsequentUploadInput {
  appData: AppData | null | undefined;
  accountId?: string | null;
  ownerUserId?: string | null;
  lastCloudSnapshot?: CloudSubsequentUploadCloudSnapshotMetadata | null;
  localSyncState: CloudSubsequentUploadLocalSyncState | null;
  gateway: CloudSubsequentUploadGateway | null;
  now?: () => Date;
  allowAuditOnly?: boolean;
}

export interface CloudSubsequentUploadResult {
  ok: boolean;
  changed: boolean;
  uploaded: boolean;
  skipped: boolean;
  reason: CloudSubsequentUploadReason;
  snapshotHash: string | null;
  previousSnapshotHash: string | null;
  repairReceiptSummary?: {
    ledgerHashMatches: boolean;
    auditOnly: number;
    pendingRepairs: number;
  };
  guardResult?: UploadEligibilityGuardResult;
  passiveStatus: { line: string; tone: CloudSubsequentUploadPassiveTone };
  safeUserMessage: string;
  hiddenDebugDetails?: Record<string, unknown>;
}

const PASSIVE_OK: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '已同步',
  tone: 'ok',
};

const PASSIVE_UNCHANGED: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '无需同步',
  tone: 'ok',
};

const PASSIVE_NOT_ENABLED: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '尚未首次同步',
  tone: 'audit-pending',
};

const PASSIVE_BUSY: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '数据正在自动整理，请稍候再同步',
  tone: 'busy',
};

const PASSIVE_BACKUP_FAILED: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '数据正在自动整理，请稍候再同步',
  tone: 'backup-failed',
};

const PASSIVE_CLOUD_CONFLICT: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '同步发现云端有新内容，请稍后再试',
  tone: 'audit-pending',
};

const PASSIVE_REMOTE_CHANGED: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '云端有更新，请稍后同步',
  tone: 'audit-pending',
};

const PASSIVE_REMOTE_UNAVAILABLE: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '同步暂时不可用，已保留本地数据',
  tone: 'backup-failed',
};

const PASSIVE_CLOUD_UNAVAILABLE: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '同步暂时不可用，已保留本地数据',
  tone: 'backup-failed',
};

const PASSIVE_UPLOAD_FAILED: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '同步失败，本地数据已保留',
  tone: 'backup-failed',
};

const PASSIVE_INVALID: CloudSubsequentUploadResult['passiveStatus'] = {
  line: '同步暂缓，等待数据整理完成',
  tone: 'audit-pending',
};

const SAFE_MSG_OK = '同步完成';
const SAFE_MSG_UNCHANGED = '本地数据已和云端一致，无需重复上传';
const SAFE_MSG_NOT_ENABLED = '请先完成首次云同步设置';
const SAFE_MSG_PENDING = '本地数据正在自动整理，请稍候再同步';
const SAFE_MSG_BACKUP_FAILED = '本地备份暂不可用，已暂缓同步';
const SAFE_MSG_PARTIAL = '同步暂缓：发现需要先整理的数据';
const SAFE_MSG_MISSING_RECEIPT = '同步暂缓：缺少修复回执';
const SAFE_MSG_INVALID = '同步暂缓：数据无法识别';
const SAFE_MSG_CLOUD_CONFLICT = '同步发现云端有新内容，请稍后再确认';
const SAFE_MSG_REMOTE_CHANGED = '云端有更新，请稍后同步';
const SAFE_MSG_REMOTE_UNAVAILABLE = '云端暂时不可用，请稍后再试';
const SAFE_MSG_MISSING_EXPECTED_PREVIOUS = '尚未记录本地同步基线，请先完成首次同步';
const SAFE_MSG_CLOUD_UNAVAILABLE = '云端暂时不可用，请稍后再试';
const SAFE_MSG_UPLOAD_FAILED = '同步失败，本地数据已保留';
const SAFE_MSG_UNKNOWN = '同步暂缓：未知原因';

const blocked = (input: {
  reason: CloudSubsequentUploadReason;
  snapshotHash: string | null;
  previousSnapshotHash: string | null;
  passiveStatus: CloudSubsequentUploadResult['passiveStatus'];
  safeUserMessage: string;
  guardResult?: UploadEligibilityGuardResult;
  hiddenDebugDetails?: Record<string, unknown>;
}): CloudSubsequentUploadResult => ({
  ok: false,
  changed: false,
  uploaded: false,
  skipped: false,
  reason: input.reason,
  snapshotHash: input.snapshotHash,
  previousSnapshotHash: input.previousSnapshotHash,
  passiveStatus: input.passiveStatus,
  safeUserMessage: input.safeUserMessage,
  guardResult: input.guardResult,
  hiddenDebugDetails: input.hiddenDebugDetails,
});

const fromGuard = (
  guard: UploadEligibilityGuardResult,
  snapshotHash: string | null,
  previousSnapshotHash: string | null,
): CloudSubsequentUploadResult => {
  let reason: CloudSubsequentUploadReason;
  let passiveStatus: CloudSubsequentUploadResult['passiveStatus'];
  let safeUserMessage: string;
  switch (guard.reason) {
    case 'pending_safe_repairs':
      reason = 'pending_safe_repairs';
      passiveStatus = PASSIVE_BUSY;
      safeUserMessage = SAFE_MSG_PENDING;
      break;
    case 'backup_failed':
      reason = 'backup_failed';
      passiveStatus = PASSIVE_BACKUP_FAILED;
      safeUserMessage = SAFE_MSG_BACKUP_FAILED;
      break;
    case 'partially_repaired':
      reason = 'partially_repaired';
      passiveStatus = PASSIVE_BUSY;
      safeUserMessage = SAFE_MSG_PARTIAL;
      break;
    case 'missing_repair_receipt':
      reason = 'missing_repair_receipt';
      passiveStatus = PASSIVE_BUSY;
      safeUserMessage = SAFE_MSG_MISSING_RECEIPT;
      break;
    case 'invalid_appdata':
      reason = 'invalid_appdata';
      passiveStatus = PASSIVE_INVALID;
      safeUserMessage = SAFE_MSG_INVALID;
      break;
    case 'audit_only_blocked':
      reason = 'partially_repaired';
      passiveStatus = PASSIVE_BUSY;
      safeUserMessage = SAFE_MSG_PARTIAL;
      break;
    default:
      reason = 'unknown';
      passiveStatus = PASSIVE_UPLOAD_FAILED;
      safeUserMessage = SAFE_MSG_UNKNOWN;
      break;
  }
  const result = blocked({
    reason,
    snapshotHash,
    previousSnapshotHash,
    passiveStatus,
    safeUserMessage,
    guardResult: guard,
  });
  if (guard.eligibility) {
    result.repairReceiptSummary = buildRepairReceiptSummary(guard);
  }
  return result;
};

const buildRepairReceiptSummary = (
  guard: UploadEligibilityGuardResult,
): CloudSubsequentUploadResult['repairReceiptSummary'] => {
  if (!guard.eligibility) return undefined;
  return {
    ledgerHashMatches: guard.eligibility.ledgerHashMatches,
    auditOnly: guard.eligibility.auditOnly,
    pendingRepairs: guard.eligibility.pendingRepairs,
  };
};

export const runCloudSubsequentUpload = async (
  input: CloudSubsequentUploadInput,
): Promise<CloudSubsequentUploadResult> => {
  const now = input.now || (() => new Date());

  if (!input.appData) {
    return blocked({
      reason: 'invalid_appdata',
      snapshotHash: null,
      previousSnapshotHash: input.localSyncState?.syncedAppDataHash ?? null,
      passiveStatus: PASSIVE_INVALID,
      safeUserMessage: SAFE_MSG_INVALID,
    });
  }

  const localHash = buildAppDataSnapshotHash(input.appData);
  const previousHash = input.localSyncState?.syncedAppDataHash ?? null;

  if (!previousHash) {
    return blocked({
      reason: 'not_enabled',
      snapshotHash: localHash,
      previousSnapshotHash: null,
      passiveStatus: PASSIVE_NOT_ENABLED,
      safeUserMessage: SAFE_MSG_NOT_ENABLED,
    });
  }

  if (
    input.localSyncState?.syncedOwnerUserId &&
    input.ownerUserId &&
    input.localSyncState.syncedOwnerUserId !== input.ownerUserId
  ) {
    return blocked({
      reason: 'not_enabled',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      passiveStatus: PASSIVE_NOT_ENABLED,
      safeUserMessage: SAFE_MSG_NOT_ENABLED,
    });
  }

  // V5 Cloud Optimistic Concurrency preflight. When the gateway provides a
  // fresh-read capability, re-read cloud latest BEFORE any short-circuit
  // (unchanged / cloud_conflict / eligibility / write). This is required so
  // "local hash matches synced hash but cloud moved on" surfaces as
  // `remote_changed`, not as the misleading `unchanged`. The check is gated
  // on `gateway.readLatestSnapshot` being a function so legacy V4 callers
  // (gateway: null, or gateway with only writeSnapshot) keep their previous
  // semantics. A non-atomic window remains between this read and the actual
  // insert; future V6 server-side compare-and-insert RPC is the only way to
  // close it.
  if (input.gateway && typeof input.gateway.readLatestSnapshot === 'function') {
    // Defense-in-depth: previousHash should never be null here because the
    // `not_enabled` short-circuit above already returns when it is. Re-check
    // and surface as a distinct reason so contract violations are loud.
    if (!previousHash) {
      return blocked({
        reason: 'missing_expected_previous_snapshot',
        snapshotHash: localHash,
        previousSnapshotHash: null,
        passiveStatus: PASSIVE_NOT_ENABLED,
        safeUserMessage: SAFE_MSG_MISSING_EXPECTED_PREVIOUS,
      });
    }
    let freshLatest: Awaited<
      ReturnType<NonNullable<CloudSubsequentUploadGateway['readLatestSnapshot']>>
    >;
    try {
      freshLatest = await input.gateway.readLatestSnapshot({
        accountId: input.accountId ?? null,
        ownerUserId:
          input.ownerUserId ?? input.localSyncState?.syncedOwnerUserId ?? null,
      });
    } catch (error) {
      return blocked({
        reason: 'remote_unavailable',
        snapshotHash: localHash,
        previousSnapshotHash: previousHash,
        passiveStatus: PASSIVE_REMOTE_UNAVAILABLE,
        safeUserMessage: SAFE_MSG_REMOTE_UNAVAILABLE,
        hiddenDebugDetails: {
          readLatestException: error instanceof Error ? error.message : String(error),
        },
      });
    }
    if (!freshLatest.ok) {
      return blocked({
        reason: 'remote_unavailable',
        snapshotHash: localHash,
        previousSnapshotHash: previousHash,
        passiveStatus: PASSIVE_REMOTE_UNAVAILABLE,
        safeUserMessage: SAFE_MSG_REMOTE_UNAVAILABLE,
        hiddenDebugDetails: { readLatestError: freshLatest.error ?? null },
      });
    }
    const observed =
      typeof freshLatest.sourceSnapshotHash === 'string'
        ? freshLatest.sourceSnapshotHash
        : null;
    if (observed !== previousHash) {
      return blocked({
        reason: 'remote_changed',
        snapshotHash: localHash,
        previousSnapshotHash: previousHash,
        passiveStatus: PASSIVE_REMOTE_CHANGED,
        safeUserMessage: SAFE_MSG_REMOTE_CHANGED,
        hiddenDebugDetails: {
          expectedPreviousHash: previousHash,
          observedCloudLatestHash: observed,
          observedCloudLatestCreatedAt: freshLatest.createdAt ?? null,
        },
      });
    }
  }

  if (localHash === previousHash) {
    return {
      ok: true,
      changed: false,
      uploaded: false,
      skipped: true,
      reason: 'unchanged',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      passiveStatus: PASSIVE_UNCHANGED,
      safeUserMessage: SAFE_MSG_UNCHANGED,
    };
  }

  if (
    input.lastCloudSnapshot &&
    typeof input.lastCloudSnapshot.sourceSnapshotHash === 'string' &&
    input.lastCloudSnapshot.sourceSnapshotHash !== previousHash
  ) {
    return blocked({
      reason: 'cloud_conflict',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      passiveStatus: PASSIVE_CLOUD_CONFLICT,
      safeUserMessage: SAFE_MSG_CLOUD_CONFLICT,
      hiddenDebugDetails: {
        expectedPreviousHash: previousHash,
        observedCloudHash: input.lastCloudSnapshot.sourceSnapshotHash,
      },
    });
  }

  const guard = ensureCloudUploadEligible({
    appData: input.appData,
    source: 'manual-upload',
    snapshotKind: 'subsequent-upload',
    accountId: input.accountId ?? undefined,
    allowAuditOnly: input.allowAuditOnly ?? true,
    now,
  });

  if (!guard.ok) {
    return fromGuard(guard, localHash, previousHash);
  }

  if (!input.gateway) {
    return blocked({
      reason: 'cloud_unavailable',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      passiveStatus: PASSIVE_CLOUD_UNAVAILABLE,
      safeUserMessage: SAFE_MSG_CLOUD_UNAVAILABLE,
      guardResult: guard,
    });
  }

  const nowIso = now().toISOString();
  try {
    const writeResult = await input.gateway.writeSnapshot({
      appData: input.appData,
      expectedPreviousHash: previousHash,
      nextSnapshotHash: localHash,
      accountId: input.accountId ?? null,
      ownerUserId: input.ownerUserId ?? input.localSyncState?.syncedOwnerUserId ?? null,
      nowIso,
    });

    if (!writeResult.ok) {
      return blocked({
        reason: 'upload_failed',
        snapshotHash: localHash,
        previousSnapshotHash: previousHash,
        passiveStatus: PASSIVE_UPLOAD_FAILED,
        safeUserMessage: SAFE_MSG_UPLOAD_FAILED,
        guardResult: guard,
        hiddenDebugDetails: { gatewayError: writeResult.error ?? null },
      });
    }

    return {
      ok: true,
      changed: true,
      uploaded: true,
      skipped: false,
      reason: 'uploaded',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      repairReceiptSummary: buildRepairReceiptSummary(guard),
      guardResult: guard,
      passiveStatus: PASSIVE_OK,
      safeUserMessage: SAFE_MSG_OK,
      hiddenDebugDetails: {
        cloudSnapshotId: writeResult.snapshotId ?? null,
        cloudCreatedAt: writeResult.createdAt ?? null,
      },
    };
  } catch (error) {
    return blocked({
      reason: 'cloud_unavailable',
      snapshotHash: localHash,
      previousSnapshotHash: previousHash,
      passiveStatus: PASSIVE_CLOUD_UNAVAILABLE,
      safeUserMessage: SAFE_MSG_CLOUD_UNAVAILABLE,
      guardResult: guard,
      hiddenDebugDetails: {
        gatewayException: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

export const computeSubsequentUploadPassiveLine = (params: {
  appData: AppData | null | undefined;
  localSyncState: CloudSubsequentUploadLocalSyncState | null;
}): { line: string; tone: CloudSubsequentUploadPassiveTone } => {
  if (!params.appData) return PASSIVE_INVALID;
  if (!params.localSyncState?.syncedAppDataHash) return PASSIVE_NOT_ENABLED;
  const localHash = buildAppDataSnapshotHash(params.appData);
  if (localHash === params.localSyncState.syncedAppDataHash) return PASSIVE_OK;
  return { line: '本地有更新，等待同步', tone: 'busy' };
};

export const CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES: readonly CloudSubsequentUploadReason[] = [
  'uploaded',
  'unchanged',
  'not_enabled',
  'pending_safe_repairs',
  'backup_failed',
  'partially_repaired',
  'missing_repair_receipt',
  'invalid_appdata',
  'cloud_conflict',
  'remote_changed',
  'remote_unavailable',
  'missing_expected_previous_snapshot',
  'cloud_unavailable',
  'upload_failed',
  'unknown',
];
