import type { AppData, ExercisePrescription, TrainingSession, TrainingSetLog } from '../../models/training-model';
import type {
  RepairApplyOptions,
  RepairApplyResult,
  RepairDefinition,
  RepairDetectResult,
  RepairDryRunResult,
} from '../appDataRepairTypes';
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'setIndexRenumberV1';

type Finding = {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  before: number[];
  after: number[];
};

const collect = (history: TrainingSession[]): Finding[] => {
  const findings: Finding[] = [];
  history.forEach((session) => {
    (session.exercises || []).forEach((exercise: ExercisePrescription) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      if (sets.length < 2) return;
      const before = sets.map((s) => (typeof s.setIndex === 'number' ? s.setIndex : -1));
      const allZero = before.every((v) => v === 0);
      const duplicates = new Set(before).size !== before.length;
      if (!allZero && !duplicates) return;
      const after = sets.map((_, idx) => idx);
      findings.push({
        sessionId: session.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name || exercise.id,
        before,
        after,
      });
    });
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
    affectedIds: findings.map((entry) => `${entry.sessionId}/${entry.exerciseId}`),
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `${findings.length} 个动作的 set 序号全部为 0 或重复，会影响顺序排序`
      : 'set 序号顺序正常',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const findings = collect(appData.history || []);
  const sample = sampleBeforeAfter(
    findings.map((entry) => ({
      id: `${entry.sessionId}/${entry.exerciseId}`,
      before: `${entry.exerciseName}: setIndex=[${entry.before.join(',')}]`,
      after: `${entry.exerciseName}: setIndex=[${entry.after.join(',')}]`,
    })),
  );
  return {
    ...detectResult,
    changeSummary: '按 sets 数组顺序重新编号 setIndex (0..n-1)。真实重量/次数/RIR 不变。',
    changedPaths: ['history[].exercises[].sets[].setIndex'],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const findings = collect(appData.history || []);
  const draft = cloneAppData(appData);
  draft.history = (draft.history || []).map((session) => {
    const sessionFindings = findings.filter((entry) => entry.sessionId === session.id);
    if (sessionFindings.length === 0) return session;
    const nextExercises = (session.exercises || []).map((exercise) => {
      const finding = sessionFindings.find((entry) => entry.exerciseId === exercise.id);
      if (!finding) return exercise;
      const sourceSets = Array.isArray(exercise.sets) ? exercise.sets : [];
      const sets = sourceSets.map(
        (set: TrainingSetLog, idx: number): TrainingSetLog => ({ ...set, setIndex: idx }),
      );
      return { ...exercise, sets };
    });
    return { ...session, exercises: nextExercises };
  });
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: draft,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'set_index_renumber',
      action: '按顺序重新编号 setIndex（保留真实重量/次数/RIR）',
      affectedIds: findings.map((entry) => `${entry.sessionId}/${entry.exerciseId}`),
      beforeSummary: `${findings.length} 个动作 setIndex 异常`,
      afterSummary: '已按数组顺序重新编号',
      repairedAt: options.repairedAt,
      before: findings,
    }),
    warnings: [],
  };
};

export const setIndexRenumberV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'set_index_renumber',
  description: '按顺序重新编号 setIndex',
  affectedAppDataPaths: ['history[].exercises[].sets[].setIndex'],
  detect,
  dryRun,
  apply,
};
