import type { AppData, TrainingSession } from '../../models/training-model';
import type {
  RepairApplyOptions,
  RepairApplyResult,
  RepairDefinition,
  RepairDetectResult,
  RepairDryRunResult,
} from '../appDataRepairTypes';
import { buildReceipt, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'legacyFinalAdviceIsolationGuardV1';

export const LEGACY_ADVICE_FIELDS = [
  'exercise.suggestion',
  'exercise.adjustment',
  'exercise.warning',
  'exercise.prescription.weeklyAdjustment',
  'session.explanations',
  'session.deloadDecision',
] as const;

type Finding = {
  sessionId: string;
  hits: string[];
};

const collect = (history: TrainingSession[]): Finding[] => {
  const findings: Finding[] = [];
  history.forEach((session) => {
    const hits: string[] = [];
    if (Array.isArray(session.explanations) && session.explanations.length > 0) hits.push('session.explanations');
    if (session.deloadDecision) hits.push('session.deloadDecision');
    (session.exercises || []).forEach((exercise) => {
      if (typeof exercise.suggestion === 'string' && exercise.suggestion.trim()) hits.push('exercise.suggestion');
      if (typeof exercise.adjustment === 'string' && exercise.adjustment.trim()) hits.push('exercise.adjustment');
      if (typeof exercise.warning === 'string' && exercise.warning.trim()) hits.push('exercise.warning');
      const prescription = (exercise.prescription || {}) as Record<string, unknown>;
      if (typeof prescription.weeklyAdjustment === 'string' && (prescription.weeklyAdjustment as string).trim()) {
        hits.push('exercise.prescription.weeklyAdjustment');
      }
    });
    if (hits.length > 0) {
      findings.push({ sessionId: session.id, hits: Array.from(new Set(hits)) });
    }
  });
  return findings;
};

const detect = (appData: AppData): RepairDetectResult => {
  const findings = collect(appData.history || []);
  const detected = findings.length > 0;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: findings.length,
    affectedIds: findings.map((entry) => entry.sessionId),
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `${findings.length} 个历史会话仍保留旧版最终建议字段；Runtime Guard 已将其从 V2 推荐输入中剔除`
      : '没有发现旧版最终建议字段',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const findings = collect(appData.history || []);
  const sample = sampleBeforeAfter(
    findings.map((entry) => ({
      id: entry.sessionId,
      before: `仍保留：${entry.hits.join(', ')}`,
      after: '保留为历史快照；CleanAppDataView 已剔除这些字段，不进入 TrainingDecision',
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      'Runtime Guard：CleanAppDataView 永远不向 TrainingDecision V2 暴露 suggestion / adjustment / warning / prescription.weeklyAdjustment / session.explanations / session.deloadDecision。AppData 本身保留旧字段，仅用于历史快照显示。',
    changedPaths: [],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const findings = collect(appData.history || []);
  return {
    repairId: REPAIR_ID,
    status: 'skipped',
    repairedData: appData,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'legacy_advice_isolation',
      action: '运行时隔离旧版最终建议字段',
      affectedIds: findings.map((entry) => entry.sessionId),
      beforeSummary:
        findings.length > 0
          ? `${findings.length} 个历史会话保留旧版字段（仅审计）`
          : '没有旧版最终建议字段',
      afterSummary: '未修改 AppData；CleanAppDataView 保证 V2 推荐输入不读取旧字段',
      repairedAt: options.repairedAt,
    }),
    warnings: ['runtime guard + audit: no AppData mutation; protection lives in CleanAppDataView'],
  };
};

export const legacyFinalAdviceIsolationGuardV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'runtime_guard',
  category: 'legacy_advice_isolation',
  description: '旧版最终建议字段在 CleanAppDataView 中被剔除',
  affectedAppDataPaths: [],
  detect,
  dryRun,
  apply,
};
