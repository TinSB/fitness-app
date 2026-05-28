import type { AppData } from '../../models/training-model';
import {
  type RepairApplyOptions,
  type RepairApplyResult,
  type RepairDefinition,
  type RepairDetectResult,
  type RepairDryRunResult,
} from '../appDataRepairTypes';
import {
  applyTodayStatusGuard,
  defaultGuardClock,
  readRuntimeFlags,
  writeRuntimeFlags,
  type RuntimeGuardClock,
} from '../dataHealthRuntimeGuard';
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'staleTodayStatusV1';

const detect = (appData: AppData): RepairDetectResult => {
  const guard = applyTodayStatusGuard(appData, defaultGuardClock);
  const flags = readRuntimeFlags(appData);
  const alreadyMarked =
    typeof flags.todayStatusIgnoredAt === 'string' &&
    flags.todayStatusObservedDate === guard.observedDate;
  const detected = guard.ignoredForCurrentReadiness && !alreadyMarked;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: detected ? 1 : 0,
    affectedIds: detected ? ['todayStatus'] : [],
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `今日状态最后更新于 ${guard.daysOld ?? '?'} 天前（${guard.observedDate ?? '?'}），不再作为今天准备度依据`
      : '今日状态足够新鲜',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const guard = applyTodayStatusGuard(appData, defaultGuardClock);
  const sample = sampleBeforeAfter(
    detectResult.detected
      ? [
          {
            id: 'todayStatus',
            before: `date=${guard.observedDate}（${guard.daysOld} 天前）`,
            after: '保留主观项；标记 settings.dataHealthRuntimeFlags.todayStatusIgnoredAt，准备度计算不再消费过期状态',
          },
        ]
      : [],
  );
  return {
    ...detectResult,
    changeSummary:
      '不删除用户填写的睡眠/精力/酸痛/时长。只在 settings.dataHealthRuntimeFlags.todayStatusIgnoredAt 写入过期时间，由 Runtime Guard 跳过此过期状态。',
    changedPaths: ['settings.dataHealthRuntimeFlags.todayStatusIgnoredAt'],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}, clock: RuntimeGuardClock = defaultGuardClock): RepairApplyResult => {
  const guard = applyTodayStatusGuard(appData, clock);
  if (!guard.ignoredForCurrentReadiness) {
    return {
      repairId: REPAIR_ID,
      status: 'no_op',
      repairedData: appData,
      receipt: buildReceipt({
        repairId: REPAIR_ID,
        category: 'readiness_freshness',
        action: '标记过期 today status 跳过',
        affectedIds: [],
        beforeSummary: '今日状态足够新鲜',
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
    todayStatusIgnoredAt: stamp,
    todayStatusObservedDate: guard.observedDate,
  };
  const updated = writeRuntimeFlags(draft, next);
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: updated,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'readiness_freshness',
      action: '标记过期 today status 在准备度中被跳过（保留主观项）',
      affectedIds: ['settings.dataHealthRuntimeFlags.todayStatusIgnoredAt'],
      beforeSummary: `today status 最后更新于 ${guard.observedDate} （${guard.daysOld} 天前）`,
      afterSummary: '已标记忽略；用户重新填写今日状态后自动恢复使用',
      repairedAt: options.repairedAt,
      before: { date: guard.observedDate, daysOld: guard.daysOld },
    }),
    warnings: [],
  };
};

export const staleTodayStatusV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'readiness_freshness',
  description: '标记过期 today status 在准备度中被跳过',
  affectedAppDataPaths: ['settings.dataHealthRuntimeFlags.todayStatusIgnoredAt'],
  detect,
  dryRun,
  apply,
};
