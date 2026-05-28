import type { AdaptiveState, AppData, ScreeningProfile } from '../../models/training-model';
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
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'screeningIssueScoreRepairV1';

const isFullySafeToWrite = (screening: ScreeningProfile | undefined): boolean => {
  if (!screening) return false;
  const flags = screening.movementFlags || {};
  const values = Object.values(flags);
  if (!values.length) return false;
  if (!values.every((value) => value === 'good')) return false;
  if ((screening.painTriggers || []).length > 0) return false;
  if ((screening.restrictedExercises || []).length > 0) return false;
  return true;
};

const detect = (appData: AppData): RepairDetectResult => {
  const cap = applyIssueScoreCap(appData.screeningProfile);
  const safeToWrite = isFullySafeToWrite(appData.screeningProfile);
  const detected = cap.changes.length > 0 && safeToWrite;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: detected ? cap.changes.length : 0,
    affectedIds: detected ? cap.changes.map((entry) => entry.key) : [],
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `${cap.changes.length} 项 issueScores 与全好的 movementFlags 不一致，将把异常分数收敛写回（含 before/after 收据）`
      : '没有可以安全写回的 issueScores 收敛动作',
    hiddenDetails: { safeToWrite, changes: cap.changes },
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const cap = applyIssueScoreCap(appData.screeningProfile);
  const sample = sampleBeforeAfter(
    cap.changes.map((entry) => ({
      id: entry.key,
      before: `${entry.key}=${entry.before}`,
      after: `${entry.key}=${entry.after}（持久化）`,
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      `把异常 issueScores 收敛到合理范围（硬上限 ${DATA_HEALTH_ISSUE_SCORE_HARD_CAP}，软上限 ${DATA_HEALTH_ISSUE_SCORE_SOFT_CAP}）。只在 movementFlags 全部 good 且无 pain/restriction 时执行写回。painByExercise / painTriggers / restrictedExercises 保持不变。`,
    changedPaths: ['screeningProfile.adaptiveState.issueScores'],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const detected = detect(appData);
  if (!detected.detected) {
    return {
      repairId: REPAIR_ID,
      status: 'no_op',
      repairedData: appData,
      receipt: buildReceipt({
        repairId: REPAIR_ID,
        category: 'screening_decay',
        action: 'issueScores 安全收敛',
        affectedIds: [],
        beforeSummary: '无需收敛或不满足安全写回前置条件',
        afterSummary: '未变更',
        repairedAt: options.repairedAt,
      }),
      warnings: [],
    };
  }
  const draft = cloneAppData(appData);
  const cap = applyIssueScoreCap(draft.screeningProfile);
  const screening = draft.screeningProfile as ScreeningProfile;
  const adaptive = screening.adaptiveState as AdaptiveState;
  const before = { issueScores: { ...adaptive.issueScores } };
  draft.screeningProfile = {
    ...screening,
    adaptiveState: {
      ...adaptive,
      issueScores: cap.cappedScores,
    },
  };
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: draft,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'screening_decay',
      action: 'issueScores 安全写回（保留 painByExercise / painTriggers / restrictedExercises）',
      affectedIds: cap.changes.map((entry) => entry.key),
      beforeSummary: `${cap.changes.length} 项异常分数`,
      afterSummary: `${cap.changes.length} 项分数已收敛写回`,
      repairedAt: options.repairedAt,
      before,
      after: { issueScores: cap.cappedScores },
    }),
    warnings: [],
  };
};

export const screeningIssueScoreRepairV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'screening_decay',
  description: 'issueScores 安全收敛（仅在 movementFlags 全好且无 pain/restriction 时写回）',
  affectedAppDataPaths: ['screeningProfile.adaptiveState.issueScores'],
  detect,
  dryRun,
  apply,
};
