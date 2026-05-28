import type { AppData, DataRepairLogEntry } from '../models/training-model';

export type RepairLayer = 'runtime_guard' | 'safe_auto' | 'audit_only';

export type RepairCategory =
  | 'session_lifecycle'
  | 'duration_sanity'
  | 'readiness_freshness'
  | 'screening_decay'
  | 'legacy_advice_isolation'
  | 'set_index_renumber'
  | 'identity_audit'
  | 'unit_display';

export type RepairSeverity = 'info' | 'warning' | 'error';

export type RepairTrigger = 'boot' | 'import' | 'cloud_restore' | 'post_session' | 'manual' | 'audit';

export type RepairApplyStatus = 'applied' | 'no_op' | 'skipped' | 'failed' | 'backup_failed';

export interface RepairDetectResult {
  repairId: string;
  detected: boolean;
  occurrences: number;
  affectedIds: string[];
  severity: RepairSeverity;
  userMessage: string;
  hiddenDetails?: Record<string, unknown>;
}

export interface RepairDryRunBeforeAfter {
  id: string;
  before: string;
  after: string;
}

export interface RepairDryRunResult extends RepairDetectResult {
  changeSummary: string;
  changedPaths: string[];
  beforeAfterSample: RepairDryRunBeforeAfter[];
  idempotencyKey: string;
}

export interface RepairApplyOptions {
  repairedAt?: string;
  backupId?: string;
  triggeredBy?: RepairTrigger;
}

export interface RepairApplyResult {
  repairId: string;
  status: RepairApplyStatus;
  repairedData: AppData;
  receipt: DataRepairLogEntry;
  warnings: string[];
  appDataHashBefore?: string;
  appDataHashAfter?: string;
}

export interface RepairDefinition {
  repairId: string;
  version: 1;
  layer: RepairLayer;
  category: RepairCategory;
  description: string;
  affectedAppDataPaths: readonly string[];
  detect: (appData: AppData) => RepairDetectResult;
  dryRun: (appData: AppData) => RepairDryRunResult;
  apply?: (appData: AppData, options?: RepairApplyOptions) => RepairApplyResult;
}

export interface DataHealthRepairLedgerEntry {
  ledgerId: string;
  repairId: string;
  idempotencyKey: string;
  appliedAt: string;
  triggeredBy: RepairTrigger;
  status: RepairApplyStatus;
  occurrences: number;
  affectedIds: string[];
  appDataHashBefore?: string;
  appDataHashAfter?: string;
  backupId?: string;
  receiptId?: string;
  warnings: string[];
}

export interface DataHealthRuntimeFlags {
  todayStatusIgnoredAt?: string;
  todayStatusObservedDate?: string;
  healthDataStaleSince?: string;
  healthDataObservedLatestAt?: string;
  healthDataObservedDaysOld?: number;
  screeningIssueScoreGuardedAt?: string;
}

export interface DataHealthAutoRepairSummary {
  lastRunAt?: string;
  lastTriggeredBy?: RepairTrigger;
  appliedCount: number;
  auditOnlyCount: number;
  pendingHighRiskCount: number;
  lastBackupId?: string;
  lastFailureCount: number;
}

export interface AppDataHashable {
  schemaVersion: number;
  historyLength: number;
  sessionsHash: string;
  todayStatusDate?: string;
  healthLatestSampleAt?: string;
  issueScoresHash: string;
}

export const DATA_HEALTH_TODAY_STATUS_STALE_DAYS = 3;
export const DATA_HEALTH_HEALTH_DATA_STALE_DAYS = 14;
export const DATA_HEALTH_ISSUE_SCORE_HARD_CAP = 50;
export const DATA_HEALTH_ISSUE_SCORE_SOFT_CAP = 12;
export const DATA_HEALTH_IMPOSSIBLE_DURATION_MIN = 240;
export const DATA_HEALTH_FALLBACK_DURATION_MIN = 60;
export const DATA_HEALTH_LEDGER_MAX_ENTRIES = 1000;
export const DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS = 24;
