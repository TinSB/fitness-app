import type { AppData } from '../models/training-model';
import {
  evaluateCloudUploadEligibility,
  type CloudUploadEligibility,
} from './uploadEligibility';

export type UploadEligibilityGuardSource =
  | 'explicit-first-upload'
  | 'cloud-push-candidate'
  | 'production-acceptance-orchestrator'
  | 'manual-upload'
  | 'background-future-sync';

export type UploadEligibilitySnapshotKind =
  | 'first-upload'
  | 'subsequent-upload'
  | 'shadow-preflight'
  | 'parity-write'
  | 'metadata-only';

export type UploadEligibilityGuardReason =
  | 'eligible'
  | 'pending_safe_repairs'
  | 'backup_failed'
  | 'partially_repaired'
  | 'missing_repair_receipt'
  | 'stale_runtime_guard_only'
  | 'audit_only_blocked'
  | 'invalid_appdata'
  | 'unknown';

export type UploadGuardPassiveTone = 'ok' | 'busy' | 'audit-pending' | 'backup-failed';

export interface UploadEligibilityGuardInput {
  appData: AppData | null | undefined;
  source: UploadEligibilityGuardSource;
  accountId?: string;
  snapshotKind: UploadEligibilitySnapshotKind;
  allowAuditOnly?: boolean;
  now?: () => Date;
}

export interface UploadEligibilityGuardRepairSummary {
  pendingRepairs: number;
  pendingRepairIds: string[];
  auditOnly: number;
  backupFailed: boolean;
}

export interface UploadEligibilityGuardReceiptSummary {
  ledgerHashMatches: boolean;
  appDataHash: string;
}

export interface UploadEligibilityGuardResult {
  ok: boolean;
  reason: UploadEligibilityGuardReason;
  source: UploadEligibilityGuardSource;
  snapshotKind: UploadEligibilitySnapshotKind;
  eligibility?: CloudUploadEligibility;
  repairSummary?: UploadEligibilityGuardRepairSummary;
  receiptSummary?: UploadEligibilityGuardReceiptSummary;
  passiveStatus: { line: string; tone: UploadGuardPassiveTone };
  safeUserMessage: string;
  hiddenDebugDetails?: Record<string, unknown>;
}

const PASSIVE_STATUS_OK: UploadEligibilityGuardResult['passiveStatus'] = {
  line: '数据已整理完成，可同步',
  tone: 'ok',
};

const PASSIVE_STATUS_PENDING_REPAIRS: UploadEligibilityGuardResult['passiveStatus'] = {
  line: '数据正在自动整理，稍后同步',
  tone: 'busy',
};

const PASSIVE_STATUS_BACKUP_FAILED: UploadEligibilityGuardResult['passiveStatus'] = {
  line: '数据正在自动整理，稍后同步',
  tone: 'backup-failed',
};

const PASSIVE_STATUS_AUDIT_BLOCKED: UploadEligibilityGuardResult['passiveStatus'] = {
  line: '同步暂缓，等待数据整理完成',
  tone: 'audit-pending',
};

const PASSIVE_STATUS_INVALID: UploadEligibilityGuardResult['passiveStatus'] = {
  line: '同步暂缓，等待数据整理完成',
  tone: 'backup-failed',
};

const SAFE_MESSAGE_OK = '数据健康检查通过，可同步';
const SAFE_MESSAGE_PENDING = '本地数据正在自动整理，请稍候再同步';
const SAFE_MESSAGE_BACKUP_FAILED = '本地备份暂不可用，已暂缓同步';
const SAFE_MESSAGE_PARTIAL = '同步暂缓：发现需要先整理的数据';
const SAFE_MESSAGE_MISSING_RECEIPT = '同步暂缓：缺少修复回执';
const SAFE_MESSAGE_AUDIT = '同步暂缓：仍有待人工确认的项目';
const SAFE_MESSAGE_INVALID = '同步暂缓：数据无法识别';
const SAFE_MESSAGE_UNKNOWN = '同步暂缓：未知原因';

const buildRepairSummary = (
  eligibility: CloudUploadEligibility,
): UploadEligibilityGuardRepairSummary => ({
  pendingRepairs: eligibility.pendingRepairs,
  pendingRepairIds: [...eligibility.pendingRepairIds],
  auditOnly: eligibility.auditOnly,
  backupFailed: eligibility.backupFailed,
});

const buildReceiptSummary = (
  eligibility: CloudUploadEligibility,
): UploadEligibilityGuardReceiptSummary => ({
  ledgerHashMatches: eligibility.ledgerHashMatches,
  appDataHash: eligibility.appDataHash,
});

export const ensureCloudUploadEligible = (
  input: UploadEligibilityGuardInput,
): UploadEligibilityGuardResult => {
  if (!input.appData) {
    return {
      ok: false,
      reason: 'invalid_appdata',
      source: input.source,
      snapshotKind: input.snapshotKind,
      passiveStatus: PASSIVE_STATUS_INVALID,
      safeUserMessage: SAFE_MESSAGE_INVALID,
      hiddenDebugDetails: { accountId: input.accountId },
    };
  }

  let eligibility: CloudUploadEligibility;
  try {
    eligibility = evaluateCloudUploadEligibility(input.appData, { now: input.now });
  } catch (error) {
    return {
      ok: false,
      reason: 'unknown',
      source: input.source,
      snapshotKind: input.snapshotKind,
      passiveStatus: PASSIVE_STATUS_BACKUP_FAILED,
      safeUserMessage: SAFE_MESSAGE_UNKNOWN,
      hiddenDebugDetails: {
        accountId: input.accountId,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const repairSummary = buildRepairSummary(eligibility);
  const receiptSummary = buildReceiptSummary(eligibility);
  const allowAuditOnly = input.allowAuditOnly !== false;

  if (eligibility.backupFailed) {
    return {
      ok: false,
      reason: 'backup_failed',
      source: input.source,
      snapshotKind: input.snapshotKind,
      eligibility,
      repairSummary,
      receiptSummary,
      passiveStatus: PASSIVE_STATUS_BACKUP_FAILED,
      safeUserMessage: SAFE_MESSAGE_BACKUP_FAILED,
    };
  }

  if (eligibility.pendingRepairs > 0) {
    return {
      ok: false,
      reason: 'pending_safe_repairs',
      source: input.source,
      snapshotKind: input.snapshotKind,
      eligibility,
      repairSummary,
      receiptSummary,
      passiveStatus: PASSIVE_STATUS_PENDING_REPAIRS,
      safeUserMessage: SAFE_MESSAGE_PENDING,
    };
  }

  if (!eligibility.eligible) {
    return {
      ok: false,
      reason: 'partially_repaired',
      source: input.source,
      snapshotKind: input.snapshotKind,
      eligibility,
      repairSummary,
      receiptSummary,
      passiveStatus: PASSIVE_STATUS_PENDING_REPAIRS,
      safeUserMessage: SAFE_MESSAGE_PARTIAL,
    };
  }

  if (input.snapshotKind === 'subsequent-upload' && !eligibility.ledgerHashMatches) {
    return {
      ok: false,
      reason: 'missing_repair_receipt',
      source: input.source,
      snapshotKind: input.snapshotKind,
      eligibility,
      repairSummary,
      receiptSummary,
      passiveStatus: PASSIVE_STATUS_PENDING_REPAIRS,
      safeUserMessage: SAFE_MESSAGE_MISSING_RECEIPT,
    };
  }

  if (!allowAuditOnly && eligibility.auditOnly > 0) {
    return {
      ok: false,
      reason: 'audit_only_blocked',
      source: input.source,
      snapshotKind: input.snapshotKind,
      eligibility,
      repairSummary,
      receiptSummary,
      passiveStatus: PASSIVE_STATUS_AUDIT_BLOCKED,
      safeUserMessage: SAFE_MESSAGE_AUDIT,
    };
  }

  return {
    ok: true,
    reason: 'eligible',
    source: input.source,
    snapshotKind: input.snapshotKind,
    eligibility,
    repairSummary,
    receiptSummary,
    passiveStatus: PASSIVE_STATUS_OK,
    safeUserMessage: SAFE_MESSAGE_OK,
  };
};

export const UPLOAD_ELIGIBILITY_GUARD_REASON_VALUES: readonly UploadEligibilityGuardReason[] = [
  'eligible',
  'pending_safe_repairs',
  'backup_failed',
  'partially_repaired',
  'missing_repair_receipt',
  'stale_runtime_guard_only',
  'audit_only_blocked',
  'invalid_appdata',
  'unknown',
];

export const UPLOAD_ELIGIBILITY_GUARD_SOURCE_VALUES: readonly UploadEligibilityGuardSource[] = [
  'explicit-first-upload',
  'cloud-push-candidate',
  'production-acceptance-orchestrator',
  'manual-upload',
  'background-future-sync',
];

export const UPLOAD_ELIGIBILITY_GUARD_SNAPSHOT_KINDS: readonly UploadEligibilitySnapshotKind[] = [
  'first-upload',
  'subsequent-upload',
  'shadow-preflight',
  'parity-write',
  'metadata-only',
];
