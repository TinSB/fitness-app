import type { AppData, TrainingSession } from '../../models/training-model';
import type {
  RepairApplyOptions,
  RepairApplyResult,
  RepairDefinition,
  RepairDetectResult,
  RepairDryRunResult,
} from '../appDataRepairTypes';
import { applySessionLifecycleGuard } from '../dataHealthRuntimeGuard';
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'sessionLifecycleResidueV1';

type Finding = {
  sessionId: string;
  date?: string;
  templateName?: string;
  flags: string[];
};

const collectFindings = (history: TrainingSession[]): Finding[] => {
  const findings: Finding[] = [];
  history.forEach((session) => {
    if (!session?.completed) return;
    const flags: string[] = [];
    if (session.restTimerState?.isRunning) flags.push('restTimerState.isRunning');
    if (typeof session.currentExerciseId === 'string' && session.currentExerciseId.length > 0) {
      flags.push('currentExerciseId');
    }
    if (
      typeof session.currentFocusStepId === 'string' &&
      session.currentFocusStepId.length > 0 &&
      session.currentFocusStepId !== 'completed'
    ) {
      flags.push('currentFocusStepId');
    }
    if (
      typeof session.currentSetIndex === 'number' &&
      session.currentSetIndex !== 0 &&
      session.currentSetIndex !== -1
    ) {
      flags.push('currentSetIndex');
    }
    if (Array.isArray(session.focusActualSetDrafts) && session.focusActualSetDrafts.length > 0) {
      flags.push('focusActualSetDrafts');
    }
    if (flags.length > 0) {
      findings.push({
        sessionId: session.id,
        date: session.date,
        templateName: session.templateName,
        flags,
      });
    }
  });
  return findings;
};

const detect = (appData: AppData): RepairDetectResult => {
  const findings = collectFindings(appData.history || []);
  const detected = findings.length > 0;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: findings.length,
    affectedIds: findings.map((entry) => entry.sessionId),
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `已完成会话仍带有训练状态残留：${findings.length} 个`
      : '已完成会话状态干净',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const findings = collectFindings(appData.history || []);
  const sample = sampleBeforeAfter(
    findings.map((entry) => ({
      id: entry.sessionId,
      before: `${entry.date || ''} ${entry.templateName || ''}: ${entry.flags.join(', ')}`,
      after: '休息计时关闭、当前指针清空、聚焦草稿清空（历史 sets 保留）',
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      '关闭已完成会话的休息计时器、清空 currentExerciseId / currentFocusStepId / currentSetIndex、移除 focusActualSetDrafts。已记录的训练 set 不会被删除或修改。',
    changedPaths: [
      'history[].restTimerState.isRunning',
      'history[].currentExerciseId',
      'history[].currentFocusStepId',
      'history[].currentSetIndex',
      'history[].focusActualSetDrafts',
    ],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const findings = collectFindings(appData.history || []);
  const draft = cloneAppData(appData);
  draft.history = (draft.history || []).map((session) => {
    if (!session?.completed) return session;
    const matching = findings.find((entry) => entry.sessionId === session.id);
    if (!matching) return session;
    return applySessionLifecycleGuard(session).session;
  });
  const receipt = buildReceipt({
    repairId: REPAIR_ID,
    category: 'session_lifecycle',
    action: '清理已完成会话的休息计时与聚焦草稿残留',
    affectedIds: findings.map((entry) => entry.sessionId),
    beforeSummary: `${findings.length} 个已完成会话存在状态残留`,
    afterSummary: '已完成会话恢复为完成态；历史 set 记录保留',
    repairedAt: options.repairedAt,
  });
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: draft,
    receipt,
    warnings: [],
  };
};

export const sessionLifecycleResidueV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'session_lifecycle',
  description: '清理已完成会话的休息计时与聚焦草稿残留',
  affectedAppDataPaths: [
    'history[].restTimerState',
    'history[].currentExerciseId',
    'history[].currentFocusStepId',
    'history[].currentSetIndex',
    'history[].focusActualSetDrafts',
  ],
  detect,
  dryRun,
  apply,
};
