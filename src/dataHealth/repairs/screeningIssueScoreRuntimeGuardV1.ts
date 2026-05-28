import type { AppData } from '../../models/training-model';
import {
  DATA_HEALTH_ISSUE_SCORE_HARD_CAP,
  DATA_HEALTH_ISSUE_SCORE_SOFT_CAP,
  type RepairApplyOptions,
  type RepairApplyResult,
  type RepairDefinition,
  type RepairDetectResult,
  type RepairDryRunResult,
} from '../appDataRepairTypes';
import { applyIssueScoreCap } from '../dataHealthRuntimeGuard';
import { buildReceipt, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'screeningIssueScoreRuntimeGuardV1';

const detect = (appData: AppData): RepairDetectResult => {
  const cap = applyIssueScoreCap(appData.screeningProfile);
  const detected = cap.changes.length > 0;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: cap.changes.length,
    affectedIds: cap.changes.map((entry) => entry.key),
    severity: detected ? 'error' : 'info',
    userMessage: detected
      ? `检测到 ${cap.changes.length} 项 issueScores 异常（超过硬上限 ${DATA_HEALTH_ISSUE_SCORE_HARD_CAP} 或与 movementFlags 矛盾）；运行时已上限保护`
      : 'issueScores 与 movementFlags 一致',
    hiddenDetails: { changes: cap.changes, movementFlagsAllGood: cap.movementFlagsAllGood },
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const cap = applyIssueScoreCap(appData.screeningProfile);
  const sample = sampleBeforeAfter(
    cap.changes.map((entry) => ({
      id: entry.key,
      before: `${entry.key}=${entry.before}`,
      after: `${entry.key}=${entry.after}（运行时上限）`,
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      `永远不写回 AppData。Runtime Guard 在 CleanAppDataView 上限：硬上限 ${DATA_HEALTH_ISSUE_SCORE_HARD_CAP}；当 movementFlags 全为 good 且无 pain/restriction 时软上限 ${DATA_HEALTH_ISSUE_SCORE_SOFT_CAP}。训练建议只能看到上限后的分数。`,
    changedPaths: [],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const cap = applyIssueScoreCap(appData.screeningProfile);
  return {
    repairId: REPAIR_ID,
    status: 'skipped',
    repairedData: appData,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'screening_decay',
      action: 'issueScores 运行时上限保护（不修改 AppData）',
      affectedIds: cap.changes.map((entry) => entry.key),
      beforeSummary:
        cap.changes.length > 0
          ? `${cap.changes.length} 项 issueScores 在运行时被上限保护`
          : 'issueScores 正常',
      afterSummary: '未修改 AppData；训练建议读取 CleanAppDataView 时受保护',
      repairedAt: options.repairedAt,
    }),
    warnings: ['runtime guard: no mutation by design'],
  };
};

export const screeningIssueScoreRuntimeGuardV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'runtime_guard',
  category: 'screening_decay',
  description: 'issueScores 运行时上限保护',
  affectedAppDataPaths: [],
  detect,
  dryRun,
  apply,
};
