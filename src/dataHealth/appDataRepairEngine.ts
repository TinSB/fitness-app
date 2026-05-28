import type { AppData, AppSettings, DataRepairLogEntry } from '../models/training-model';
import type {
  RepairApplyOptions,
  RepairApplyResult,
  RepairDefinition,
  RepairDetectResult,
  RepairDryRunResult,
} from './appDataRepairTypes';

const MAX_DATA_REPAIR_LOG_ENTRIES = 500;

export type AppDataRepairRegistry = {
  list: () => RepairDefinition[];
  byLayer: (layer: RepairDefinition['layer']) => RepairDefinition[];
  get: (repairId: string) => RepairDefinition | undefined;
  has: (repairId: string) => boolean;
};

export const buildRegistry = (definitions: RepairDefinition[]): AppDataRepairRegistry => {
  const byId = new Map<string, RepairDefinition>();
  definitions.forEach((definition) => {
    if (byId.has(definition.repairId)) {
      throw new Error(`[dataHealth] duplicate repair id: ${definition.repairId}`);
    }
    byId.set(definition.repairId, definition);
  });
  const ordered = Array.from(byId.values());
  return {
    list: () => ordered.slice(),
    byLayer: (layer) => ordered.filter((definition) => definition.layer === layer),
    get: (repairId) => byId.get(repairId),
    has: (repairId) => byId.has(repairId),
  };
};

export const detectAll = (
  registry: AppDataRepairRegistry,
  appData: AppData,
): RepairDetectResult[] => registry.list().map((definition) => definition.detect(appData));

export const dryRunAll = (
  registry: AppDataRepairRegistry,
  appData: AppData,
): RepairDryRunResult[] => registry.list().map((definition) => definition.dryRun(appData));

const appendDataRepairLog = (
  appData: AppData,
  receipt: DataRepairLogEntry,
): AppData => {
  const settings = (appData.settings || {}) as AppSettings;
  const existing = Array.isArray(settings.dataRepairLogs) ? settings.dataRepairLogs : [];
  const next = [...existing, receipt].slice(-MAX_DATA_REPAIR_LOG_ENTRIES);
  return {
    ...appData,
    settings: {
      ...settings,
      dataRepairLogs: next,
    },
  };
};

export const runRepair = (
  registry: AppDataRepairRegistry,
  appData: AppData,
  repairId: string,
  options: RepairApplyOptions = {},
): RepairApplyResult => {
  const definition = registry.get(repairId);
  if (!definition) {
    throw new Error(`[dataHealth] unknown repairId: ${repairId}`);
  }
  if (!definition.apply || definition.layer === 'audit_only') {
    const detect = definition.detect(appData);
    return {
      repairId,
      status: 'skipped',
      repairedData: appData,
      receipt: {
        id: `${repairId}-audit-${Date.now()}`,
        repairId,
        createdAt: options.repairedAt || new Date().toISOString(),
        repairedAt: options.repairedAt,
        category: definition.category,
        action: definition.description,
        affectedIds: detect.affectedIds,
        beforeSummary: detect.detected
          ? `${detect.occurrences} 项审计待人工确认`
          : '没有发现需要审计的数据',
        afterSummary: '未变更 AppData',
      },
      warnings: ['audit-only repair: no mutation performed'],
    };
  }

  const detect = definition.detect(appData);
  if (!detect.detected) {
    return {
      repairId,
      status: 'no_op',
      repairedData: appData,
      receipt: {
        id: `${repairId}-noop-${Date.now()}`,
        repairId,
        createdAt: options.repairedAt || new Date().toISOString(),
        repairedAt: options.repairedAt,
        category: definition.category,
        action: definition.description,
        affectedIds: [],
        beforeSummary: '检测未发现需要修复的数据',
        afterSummary: '未变更 AppData',
      },
      warnings: [],
    };
  }

  const result = definition.apply(appData, options);
  const repairedWithLog = appendDataRepairLog(result.repairedData, result.receipt);
  return {
    ...result,
    repairedData: repairedWithLog,
  };
};
