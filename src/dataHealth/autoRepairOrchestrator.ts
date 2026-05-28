import type { AppData } from '../models/training-model';
import { runRepair, type AppDataRepairRegistry } from './appDataRepairEngine';
import {
  appendLedgerEntry,
  buildLedgerEntry,
  isIdempotentMatch,
  readLedger,
} from './appDataRepairLedger';
import { getAppDataRepairRegistry } from './appDataRepairRegistry';
import type {
  DataHealthAutoRepairSummary,
  RepairApplyResult,
  RepairDefinition,
  RepairTrigger,
} from './appDataRepairTypes';
import {
  createAutoRepairBackupAdapter,
  getDefaultAutoRepairBackupAdapter,
  type AutoRepairBackupAdapter,
  type AutoRepairBackupRecord,
} from './autoRepairBackupAdapter';
import { computeAppDataHash } from './repairs/repairHelpers';

const SUMMARY_SETTINGS_KEY = 'dataHealthAutoRepairSummary';

export interface AutoRepairOrchestratorInput {
  appData: AppData;
  triggeredBy: RepairTrigger;
  registry?: AppDataRepairRegistry;
  backupAdapter?: AutoRepairBackupAdapter;
  now?: () => Date;
}

export interface AutoRepairOrchestratorResult {
  appData: AppData;
  changed: boolean;
  results: RepairApplyResult[];
  auditFindings: Array<{
    repairId: string;
    occurrences: number;
    affectedIds: string[];
    userMessage: string;
  }>;
  backup?: AutoRepairBackupRecord;
  appDataHashBefore: string;
  appDataHashAfter: string;
  summary: DataHealthAutoRepairSummary;
  warnings: string[];
}

const sumApplied = (results: RepairApplyResult[]): number =>
  results.filter((entry) => entry.status === 'applied').length;

const writeSummary = (appData: AppData, summary: DataHealthAutoRepairSummary): AppData => ({
  ...appData,
  settings: {
    ...(appData.settings || {}),
    [SUMMARY_SETTINGS_KEY]: summary,
  },
});

export const runAutoRepairOrchestrator = async (
  input: AutoRepairOrchestratorInput,
): Promise<AutoRepairOrchestratorResult> => {
  const registry = input.registry || getAppDataRepairRegistry();
  const backupAdapter = input.backupAdapter || getDefaultAutoRepairBackupAdapter();
  const now = input.now || (() => new Date());

  const appDataHashBefore = computeAppDataHash(input.appData);
  const safeAutoDefinitions = registry.byLayer('safe_auto').filter((definition) => Boolean(definition.apply));
  const auditDefinitions = registry.byLayer('audit_only');

  const repairsToApply: Array<{ definition: RepairDefinition; occurrences: number; affectedIds: string[] }> = [];
  safeAutoDefinitions.forEach((definition) => {
    const detectResult = definition.detect(input.appData);
    if (!detectResult.detected) return;
    repairsToApply.push({
      definition,
      occurrences: detectResult.occurrences,
      affectedIds: detectResult.affectedIds,
    });
  });

  const auditFindings = auditDefinitions
    .map((definition) => definition.detect(input.appData))
    .filter((entry) => entry.detected)
    .map((entry) => ({
      repairId: entry.repairId,
      occurrences: entry.occurrences,
      affectedIds: entry.affectedIds,
      userMessage: entry.userMessage,
    }));

  if (repairsToApply.length === 0) {
    const ledger = readLedger(input.appData);
    const summary = buildSummary({
      ledger,
      auditCount: auditFindings.length,
      triggeredBy: input.triggeredBy,
      now: now(),
    });
    return {
      appData: writeSummary(input.appData, summary),
      changed: false,
      results: [],
      auditFindings,
      appDataHashBefore,
      appDataHashAfter: appDataHashBefore,
      summary,
      warnings: [],
    };
  }

  let backup: AutoRepairBackupRecord | undefined;
  let backupFailed = false;
  try {
    backup = await backupAdapter.snapshot({
      appData: input.appData,
      triggeredBy: input.triggeredBy,
      appDataHashBefore,
      repairIdScope: repairsToApply.map((entry) => entry.definition.repairId),
    });
  } catch (_error) {
    backupFailed = true;
  }

  if (backupFailed) {
    const stampedAt = now().toISOString();
    const ledger = readLedger(input.appData);
    const newLedgerEntries = repairsToApply.map((entry) =>
      buildLedgerEntry({
        repairId: entry.definition.repairId,
        idempotencyKey: `backup-failed-${appDataHashBefore}`,
        appliedAt: stampedAt,
        triggeredBy: input.triggeredBy,
        status: 'backup_failed',
        occurrences: entry.occurrences,
        affectedIds: entry.affectedIds,
        appDataHashBefore,
        warnings: ['backup adapter rejected; runtime guard remains active'],
      }),
    );
    let working = input.appData;
    newLedgerEntries.forEach((entry) => {
      working = appendLedgerEntry(working, entry);
    });
    const summary = buildSummary({
      ledger: [...ledger, ...newLedgerEntries],
      auditCount: auditFindings.length,
      triggeredBy: input.triggeredBy,
      now: now(),
    });
    return {
      appData: writeSummary(working, summary),
      changed: false,
      results: [],
      auditFindings,
      appDataHashBefore,
      appDataHashAfter: appDataHashBefore,
      summary,
      warnings: ['backup_failed: no mutation performed; Runtime Guard still protects recommendation'],
    };
  }

  let working = input.appData;
  const results: RepairApplyResult[] = [];
  const warnings: string[] = [];

  for (const item of repairsToApply) {
    const ledger = readLedger(working);
    const dryRun = item.definition.dryRun(working);
    const idempotent = isIdempotentMatch(ledger, item.definition.repairId, dryRun.idempotencyKey, undefined, now());
    if (idempotent) {
      continue;
    }
    const repairResult = runRepair(registry, working, item.definition.repairId, {
      repairedAt: now().toISOString(),
      backupId: backup?.id,
      triggeredBy: input.triggeredBy,
    });
    results.push(repairResult);
    if (repairResult.status === 'applied') {
      const postDetect = item.definition.detect(repairResult.repairedData);
      const finalStatus = postDetect.detected ? 'failed' : 'applied';
      const ledgerEntry = buildLedgerEntry({
        repairId: item.definition.repairId,
        idempotencyKey: dryRun.idempotencyKey,
        appliedAt: now().toISOString(),
        triggeredBy: input.triggeredBy,
        status: finalStatus,
        occurrences: item.occurrences,
        affectedIds: item.affectedIds,
        appDataHashBefore,
        appDataHashAfter: computeAppDataHash(repairResult.repairedData),
        backupId: backup?.id,
        receiptId: repairResult.receipt.id,
      });
      working = appendLedgerEntry(repairResult.repairedData, ledgerEntry);
      if (finalStatus === 'failed') {
        warnings.push(`${item.definition.repairId}: post-state detect still reports issue; flagged failed`);
      }
    } else {
      const ledgerEntry = buildLedgerEntry({
        repairId: item.definition.repairId,
        idempotencyKey: dryRun.idempotencyKey,
        appliedAt: now().toISOString(),
        triggeredBy: input.triggeredBy,
        status: repairResult.status,
        occurrences: item.occurrences,
        affectedIds: item.affectedIds,
        appDataHashBefore,
        appDataHashAfter: computeAppDataHash(repairResult.repairedData),
        backupId: backup?.id,
        receiptId: repairResult.receipt.id,
      });
      working = appendLedgerEntry(repairResult.repairedData, ledgerEntry);
    }
  }

  const ledgerAfter = readLedger(working);
  const summary = buildSummary({
    ledger: ledgerAfter,
    auditCount: auditFindings.length,
    triggeredBy: input.triggeredBy,
    backupId: backup?.id,
    now: now(),
  });
  const appDataHashAfter = computeAppDataHash(working);
  return {
    appData: writeSummary(working, summary),
    changed: sumApplied(results) > 0,
    results,
    auditFindings,
    backup,
    appDataHashBefore,
    appDataHashAfter,
    summary,
    warnings,
  };
};

const buildSummary = (input: {
  ledger: ReturnType<typeof readLedger>;
  auditCount: number;
  triggeredBy: RepairTrigger;
  backupId?: string;
  now: Date;
}): DataHealthAutoRepairSummary => {
  const recent = input.ledger.filter((entry) => {
    const at = new Date(entry.appliedAt);
    return !Number.isNaN(at.getTime()) && at.getTime() >= input.now.getTime() - 7 * 24 * 3600 * 1000;
  });
  const applied = recent.filter((entry) => entry.status === 'applied').length;
  const auditOnly = recent.filter((entry) => entry.status === 'skipped').length;
  const failed = recent.filter((entry) => entry.status === 'failed' || entry.status === 'backup_failed').length;
  return {
    lastRunAt: input.now.toISOString(),
    lastTriggeredBy: input.triggeredBy,
    appliedCount: applied,
    auditOnlyCount: auditOnly + input.auditCount,
    pendingHighRiskCount: input.auditCount,
    lastBackupId: input.backupId,
    lastFailureCount: failed,
  };
};

export const readAutoRepairSummary = (appData: AppData): DataHealthAutoRepairSummary | undefined => {
  const settings = (appData.settings || {}) as { [key: string]: unknown };
  const summary = settings[SUMMARY_SETTINGS_KEY];
  if (!summary || typeof summary !== 'object') return undefined;
  return summary as DataHealthAutoRepairSummary;
};

export const __test_createAdapter = createAutoRepairBackupAdapter;
export const DATA_HEALTH_AUTO_REPAIR_SUMMARY_SETTINGS_KEY = SUMMARY_SETTINGS_KEY;
