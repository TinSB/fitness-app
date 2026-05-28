import type { AppData } from '../models/training-model';
import {
  DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS,
  DATA_HEALTH_LEDGER_MAX_ENTRIES,
  type DataHealthRepairLedgerEntry,
} from './appDataRepairTypes';

const LEDGER_SETTINGS_KEY = 'dataHealthRepairLedger';

export const readLedger = (appData: AppData): DataHealthRepairLedgerEntry[] => {
  const settings = (appData.settings || {}) as { [key: string]: unknown };
  const ledger = settings[LEDGER_SETTINGS_KEY];
  if (!Array.isArray(ledger)) return [];
  return ledger as DataHealthRepairLedgerEntry[];
};

export const writeLedger = (
  appData: AppData,
  entries: DataHealthRepairLedgerEntry[],
): AppData => {
  const truncated = entries.slice(-DATA_HEALTH_LEDGER_MAX_ENTRIES);
  return {
    ...appData,
    settings: {
      ...(appData.settings || {}),
      [LEDGER_SETTINGS_KEY]: truncated,
    },
  };
};

export const appendLedgerEntry = (
  appData: AppData,
  entry: DataHealthRepairLedgerEntry,
): AppData => writeLedger(appData, [...readLedger(appData), entry]);

export const isIdempotentMatch = (
  ledger: DataHealthRepairLedgerEntry[],
  repairId: string,
  idempotencyKey: string,
  windowHours = DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS,
  now: Date = new Date(),
): boolean => {
  const cutoff = new Date(now.getTime() - windowHours * 3600 * 1000);
  return ledger.some((entry) => {
    if (entry.repairId !== repairId) return false;
    if (entry.idempotencyKey !== idempotencyKey) return false;
    if (entry.status !== 'applied' && entry.status !== 'no_op') return false;
    const applied = new Date(entry.appliedAt);
    return !Number.isNaN(applied.getTime()) && applied >= cutoff;
  });
};

export const buildLedgerEntry = (params: {
  repairId: string;
  idempotencyKey: string;
  appliedAt: string;
  triggeredBy: DataHealthRepairLedgerEntry['triggeredBy'];
  status: DataHealthRepairLedgerEntry['status'];
  occurrences: number;
  affectedIds: string[];
  appDataHashBefore?: string;
  appDataHashAfter?: string;
  backupId?: string;
  receiptId?: string;
  warnings?: string[];
}): DataHealthRepairLedgerEntry => ({
  ledgerId: `${params.repairId}-${params.appliedAt}-${params.idempotencyKey.slice(0, 8)}`,
  repairId: params.repairId,
  idempotencyKey: params.idempotencyKey,
  appliedAt: params.appliedAt,
  triggeredBy: params.triggeredBy,
  status: params.status,
  occurrences: params.occurrences,
  affectedIds: params.affectedIds,
  appDataHashBefore: params.appDataHashBefore,
  appDataHashAfter: params.appDataHashAfter,
  backupId: params.backupId,
  receiptId: params.receiptId,
  warnings: params.warnings || [],
});

export const summarizeLedger = (
  ledger: DataHealthRepairLedgerEntry[],
  withinHours = DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS,
  now: Date = new Date(),
): { applied: number; noOp: number; failed: number; auditOnly: number; lastRunAt?: string } => {
  const cutoff = new Date(now.getTime() - withinHours * 3600 * 1000);
  let applied = 0;
  let noOp = 0;
  let failed = 0;
  let auditOnly = 0;
  let lastRunAt: string | undefined;
  ledger.forEach((entry) => {
    const at = new Date(entry.appliedAt);
    if (Number.isNaN(at.getTime()) || at < cutoff) return;
    if (!lastRunAt || at > new Date(lastRunAt)) lastRunAt = entry.appliedAt;
    switch (entry.status) {
      case 'applied':
        applied += 1;
        break;
      case 'no_op':
        noOp += 1;
        break;
      case 'failed':
      case 'backup_failed':
        failed += 1;
        break;
      case 'skipped':
        auditOnly += 1;
        break;
    }
  });
  return { applied, noOp, failed, auditOnly, lastRunAt };
};

export const APP_DATA_REPAIR_LEDGER_SETTINGS_KEY = LEDGER_SETTINGS_KEY;
