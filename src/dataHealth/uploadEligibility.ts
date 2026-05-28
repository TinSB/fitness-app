import type { AppData } from '../models/training-model';
import { getAppDataRepairRegistry } from './appDataRepairRegistry';
import { readLedger } from './appDataRepairLedger';
import type { DataHealthRepairLedgerEntry } from './appDataRepairTypes';
import { computeAppDataHash } from './repairs/repairHelpers';

export interface CloudUploadEligibility {
  eligible: boolean;
  reason: string;
  pendingRepairs: number;
  pendingRepairIds: string[];
  backupFailed: boolean;
  auditOnly: number;
  ledgerHashMatches: boolean;
  appDataHash: string;
}

const isRecentBackupFailure = (
  entry: DataHealthRepairLedgerEntry,
  currentHash: string,
  windowMs: number,
  now: Date,
): boolean => {
  if (entry.status !== 'backup_failed') return false;
  if (entry.appDataHashBefore && entry.appDataHashBefore !== currentHash) return false;
  const applied = new Date(entry.appliedAt);
  if (Number.isNaN(applied.getTime())) return false;
  return applied.getTime() >= now.getTime() - windowMs;
};

const DEFAULT_RECENT_WINDOW_MS = 30 * 60 * 1000;

export interface EvaluateCloudUploadEligibilityOptions {
  registry?: ReturnType<typeof getAppDataRepairRegistry>;
  now?: () => Date;
  recentBackupFailureWindowMs?: number;
}

export const evaluateCloudUploadEligibility = (
  appData: AppData,
  options: EvaluateCloudUploadEligibilityOptions = {},
): CloudUploadEligibility => {
  const registry = options.registry || getAppDataRepairRegistry();
  const now = (options.now || (() => new Date()))();
  const windowMs = options.recentBackupFailureWindowMs ?? DEFAULT_RECENT_WINDOW_MS;
  const appDataHash = computeAppDataHash(appData);

  const safeAuto = registry.byLayer('safe_auto');
  const pendingRepairIds: string[] = [];
  let pendingRepairs = 0;
  safeAuto.forEach((definition) => {
    if (!definition.apply) return;
    const detected = definition.detect(appData);
    if (detected.detected) {
      pendingRepairIds.push(definition.repairId);
      pendingRepairs += detected.occurrences;
    }
  });

  const ledger = readLedger(appData);
  const backupFailed = ledger.some((entry) => isRecentBackupFailure(entry, appDataHash, windowMs, now));
  const ledgerHashMatches = ledger.some((entry) => entry.appDataHashAfter === appDataHash || entry.appDataHashBefore === appDataHash);

  const auditOnlyDefs = registry.byLayer('audit_only');
  const auditOnly = auditOnlyDefs.reduce((sum, definition) => {
    const result = definition.detect(appData);
    return result.detected ? sum + 1 : sum;
  }, 0);

  if (backupFailed) {
    return {
      eligible: false,
      reason: 'data_health_backup_failed',
      pendingRepairs,
      pendingRepairIds,
      backupFailed,
      auditOnly,
      ledgerHashMatches,
      appDataHash,
    };
  }

  if (pendingRepairs > 0) {
    return {
      eligible: false,
      reason: 'data_health_pending_safe_auto_repair',
      pendingRepairs,
      pendingRepairIds,
      backupFailed,
      auditOnly,
      ledgerHashMatches,
      appDataHash,
    };
  }

  return {
    eligible: true,
    reason: 'data_health_clean',
    pendingRepairs,
    pendingRepairIds,
    backupFailed,
    auditOnly,
    ledgerHashMatches,
    appDataHash,
  };
};

export const DEFAULT_CLOUD_UPLOAD_BACKUP_FAILURE_WINDOW_MS = DEFAULT_RECENT_WINDOW_MS;
