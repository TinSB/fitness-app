import type { AppData } from '../../models/training-model';
import {
  DATA_HEALTH_HEALTH_DATA_STALE_DAYS,
  type RepairApplyOptions,
  type RepairApplyResult,
  type RepairDefinition,
  type RepairDetectResult,
  type RepairDryRunResult,
} from '../appDataRepairTypes';
import {
  applyHealthDataGuard,
  defaultGuardClock,
  readRuntimeFlags,
  writeRuntimeFlags,
  type RuntimeGuardClock,
} from '../dataHealthRuntimeGuard';
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'staleHealthReadinessGuardV1';

const detect = (appData: AppData): RepairDetectResult => {
  const guard = applyHealthDataGuard(appData, defaultGuardClock);
  const flags = readRuntimeFlags(appData);
  const alreadyMarked =
    typeof flags.healthDataStaleSince === 'string' &&
    flags.healthDataObservedLatestAt === guard.latestSampleAt;
  const detected = guard.staleForReadiness && !alreadyMarked;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: detected ? 1 : 0,
    affectedIds: detected ? ['settings.dataHealthRuntimeFlags.healthDataStaleSince'] : [],
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `导入的健康数据已经 ${guard.daysOld} 天没更新（最新样本 ${guard.latestSampleAt?.slice(0, 10) ?? '?'}），运行时已降级置信度`
      : '健康数据足够新鲜或未启用',
    hiddenDetails: { ...guard },
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const guard = applyHealthDataGuard(appData, defaultGuardClock);
  const sample = sampleBeforeAfter(
    detectResult.detected
      ? [
          {
            id: 'settings.dataHealthRuntimeFlags.healthDataStaleSince',
            before: `最新健康样本于 ${guard.latestSampleAt?.slice(0, 10)}（${guard.daysOld} 天前），useHealthDataForReadiness=${guard.useHealthDataForReadiness}`,
            after: '保留用户偏好；写入过期标记；准备度降级置信度直到新样本导入',
          },
        ]
      : [],
  );
  return {
    ...detectResult,
    changeSummary:
      `不修改 useHealthDataForReadiness 用户偏好。只在 settings.dataHealthRuntimeFlags.healthDataStaleSince 记录过期时间（阈值 ${DATA_HEALTH_HEALTH_DATA_STALE_DAYS} 天）。`,
    changedPaths: ['settings.dataHealthRuntimeFlags.healthDataStaleSince'],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}, clock: RuntimeGuardClock = defaultGuardClock): RepairApplyResult => {
  const guard = applyHealthDataGuard(appData, clock);
  if (!guard.staleForReadiness) {
    return {
      repairId: REPAIR_ID,
      status: 'no_op',
      repairedData: appData,
      receipt: buildReceipt({
        repairId: REPAIR_ID,
        category: 'readiness_freshness',
        action: '健康数据陈旧标记',
        affectedIds: [],
        beforeSummary: '健康数据新鲜或未启用',
        afterSummary: '未变更',
        repairedAt: options.repairedAt,
      }),
      warnings: [],
    };
  }
  const draft = cloneAppData(appData);
  const flags = readRuntimeFlags(draft);
  const stamp = options.repairedAt || clock.now().toISOString();
  const next = {
    ...flags,
    healthDataStaleSince: stamp,
    healthDataObservedLatestAt: guard.latestSampleAt,
    healthDataObservedDaysOld: guard.daysOld,
  };
  const updated = writeRuntimeFlags(draft, next);
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: updated,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'readiness_freshness',
      action: '健康数据陈旧标记（运行时降级置信度）',
      affectedIds: ['settings.dataHealthRuntimeFlags.healthDataStaleSince'],
      beforeSummary: `最新健康样本于 ${guard.latestSampleAt?.slice(0, 10) || '?'}（${guard.daysOld} 天前）`,
      afterSummary: '已标记陈旧；导入新样本后自动恢复',
      repairedAt: options.repairedAt,
      before: { latestSampleAt: guard.latestSampleAt, daysOld: guard.daysOld },
    }),
    warnings: [],
  };
};

export const staleHealthReadinessGuardV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'readiness_freshness',
  description: '陈旧的外部健康数据不应作为准备度强信号',
  affectedAppDataPaths: ['settings.dataHealthRuntimeFlags.healthDataStaleSince'],
  detect,
  dryRun,
  apply,
};
