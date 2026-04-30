import type { ActualSetDraft, TrainingSession, TrainingSetLog, UnitSettings, WeightUnit } from '../models/training-model';
import { number } from './engineUtils';
import { convertLbToKg, DEFAULT_UNIT_SETTINGS, parseDisplayWeightToKg } from './unitConversionEngine';

export type SetAnomalySeverity = 'info' | 'warning' | 'critical';

export type SetAnomaly = {
  id: string;
  severity: SetAnomalySeverity;
  title: string;
  message: string;
  suggestedAction?: string;
  requiresConfirmation: boolean;
};

type DraftLike = Partial<ActualSetDraft> & {
  weight?: unknown;
  reps?: unknown;
  rir?: unknown;
  setType?: unknown;
  isWarmup?: unknown;
};

type PlannedPrescriptionLike = Partial<{
  plannedWeight: number;
  plannedWeightKg: number;
  targetWeightKg: number;
  weight: number;
  workingWeightKg: number;
  topWeight: number;
  plannedReps: number;
  targetReps: number;
  reps: number;
  repMin: number;
  repMax: number;
  recommendedRepRange: [number, number];
  repRange: [number, number];
  stepType: string;
  setType: string;
  isWarmup: boolean;
}>;

export type DetectSetAnomaliesInput = {
  currentDraft?: DraftLike | null;
  exerciseId?: string;
  previousSets?: TrainingSetLog[];
  recentHistory?: TrainingSession[];
  currentSessionId?: string;
  unitSettings?: Partial<UnitSettings>;
  plannedPrescription?: PlannedPrescriptionLike | null;
};

type ResolvedDraft = {
  displayUnit: WeightUnit;
  displayWeight?: number;
  weightKg?: number;
  reps?: number;
  rir?: number;
  stepType: string;
  isWarmup: boolean;
  hasWeightInput: boolean;
  hasRepsInput: boolean;
};

const anomaly = (
  input: Omit<SetAnomaly, 'requiresConfirmation'> & { requiresConfirmation?: boolean }
): SetAnomaly => ({
  ...input,
  requiresConfirmation: input.requiresConfirmation ?? input.severity === 'critical',
});

const hasInputValue = (value: unknown) => value !== undefined && value !== null && value !== '';

const normalizeSetType = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const setTypeOf = (set: TrainingSetLog | DraftLike | PlannedPrescriptionLike | undefined | null) =>
  normalizeSetType(
    (set as { setType?: unknown } | undefined)?.setType ||
      (set as { stepType?: unknown } | undefined)?.stepType ||
      (set as { type?: unknown } | undefined)?.type,
  );

const isWarmupLike = (value: TrainingSetLog | DraftLike | PlannedPrescriptionLike | undefined | null) =>
  setTypeOf(value) === 'warmup' || Boolean((value as { isWarmup?: unknown } | undefined)?.isWarmup);

const resolveUnit = (unitSettings?: Partial<UnitSettings>, currentDraft?: DraftLike | null): WeightUnit => {
  const draftUnit = currentDraft?.displayUnit;
  if (draftUnit === 'lb' || draftUnit === 'kg') return draftUnit;
  return unitSettings?.weightUnit === 'lb' ? 'lb' : 'kg';
};

const resolveDraft = (currentDraft: DraftLike | null | undefined, unitSettings?: Partial<UnitSettings>, plannedPrescription?: PlannedPrescriptionLike | null): ResolvedDraft => {
  const displayUnit = resolveUnit(unitSettings, currentDraft);
  const rawDisplayWeight = currentDraft?.displayWeight ?? currentDraft?.weight;
  const rawActualWeight = currentDraft?.actualWeightKg;
  const hasWeightInput = hasInputValue(rawActualWeight) || hasInputValue(rawDisplayWeight);
  const hasRepsInput = hasInputValue(currentDraft?.actualReps) || hasInputValue(currentDraft?.reps);
  const displayWeight = hasInputValue(rawDisplayWeight) ? number(rawDisplayWeight) : undefined;
  const weightKg = hasInputValue(rawActualWeight)
    ? number(rawActualWeight)
    : displayWeight !== undefined
      ? parseDisplayWeightToKg(displayWeight, displayUnit)
      : undefined;

  return {
    displayUnit,
    displayWeight,
    weightKg,
    reps: hasRepsInput ? number(currentDraft?.actualReps ?? currentDraft?.reps) : undefined,
    rir: hasInputValue(currentDraft?.actualRir) || hasInputValue(currentDraft?.rir) ? number(currentDraft?.actualRir ?? currentDraft?.rir) : undefined,
    stepType: setTypeOf(currentDraft) || setTypeOf(plannedPrescription) || 'working',
    isWarmup: isWarmupLike(currentDraft) || isWarmupLike(plannedPrescription),
    hasWeightInput,
    hasRepsInput,
  };
};

const reliableWorkSet = (set: TrainingSetLog) =>
  set.done !== false && set.type !== 'warmup' && setTypeOf(set) !== 'warmup' && number(set.actualWeightKg ?? set.weight) > 0 && number(set.reps) > 0;

const completedCurrentSessionWorkSet = (set: TrainingSetLog) => set.done === true && reliableWorkSet(set);

const setWeightKg = (set: TrainingSetLog) => number(set.actualWeightKg ?? set.weight);

type ReliablePreviousWorkingSetsInput = {
  exerciseId?: string;
  history?: TrainingSession[];
  currentSessionId?: string;
};

const recordPoolIdOfExercise = (exercise: TrainingSession['exercises'][number]) =>
  String(
    exercise.actualExerciseId ||
      exercise.replacementExerciseId ||
      exercise.canonicalExerciseId ||
      (exercise.replacedFromId ? exercise.id : exercise.baseId || exercise.id) ||
      '',
  );

const isSameExerciseRecord = (exercise: TrainingSession['exercises'][number], exerciseId: string) => {
  const poolId = recordPoolIdOfExercise(exercise);
  return (
    poolId === exerciseId ||
    exercise.id === exerciseId ||
    exercise.actualExerciseId === exerciseId ||
    exercise.replacementExerciseId === exerciseId ||
    exercise.canonicalExerciseId === exerciseId ||
    exercise.baseId === exerciseId
  );
};

export const getReliablePreviousWorkingSetsForExercise = ({
  exerciseId,
  history = [],
  currentSessionId,
}: ReliablePreviousWorkingSetsInput): TrainingSetLog[] => {
  if (!exerciseId) return [];
  const sessions = [...history].sort((left, right) =>
    String(right.finishedAt || right.startedAt || right.date || '').localeCompare(String(left.finishedAt || left.startedAt || left.date || '')),
  );
  const sets: TrainingSetLog[] = [];
  for (const session of sessions) {
    if (currentSessionId && session.id === currentSessionId) continue;
    if (session.dataFlag === 'test' || session.dataFlag === 'excluded') continue;
    for (const exercise of session.exercises || []) {
      if (!isSameExerciseRecord(exercise, exerciseId)) continue;
      if (Array.isArray(exercise.sets)) sets.push(...[...exercise.sets].reverse().filter(reliableWorkSet));
    }
  }
  return sets;
};

const latestPreviousSet = (
  exerciseId: string | undefined,
  previousSets: TrainingSetLog[] = [],
  recentHistory: TrainingSession[] = [],
  currentSessionId?: string,
) => {
  const direct = [...previousSets].reverse().find(completedCurrentSessionWorkSet);
  if (direct) return direct;
  return getReliablePreviousWorkingSetsForExercise({ exerciseId, history: recentHistory, currentSessionId })[0];
};

const plannedWeightKg = (planned?: PlannedPrescriptionLike | null, displayUnit: WeightUnit = 'kg') => {
  if (!planned) return undefined;
  if (hasInputValue(planned.plannedWeightKg)) return number(planned.plannedWeightKg);
  if (hasInputValue(planned.targetWeightKg)) return number(planned.targetWeightKg);
  if (hasInputValue(planned.workingWeightKg)) return number(planned.workingWeightKg);
  if (hasInputValue(planned.topWeight)) return number(planned.topWeight);
  if (hasInputValue(planned.plannedWeight)) return parseDisplayWeightToKg(planned.plannedWeight, displayUnit);
  if (hasInputValue(planned.weight)) return parseDisplayWeightToKg(planned.weight, displayUnit);
  return undefined;
};

const plannedRepMax = (planned?: PlannedPrescriptionLike | null) => {
  if (!planned) return undefined;
  if (Array.isArray(planned.recommendedRepRange)) return number(planned.recommendedRepRange[1]);
  if (Array.isArray(planned.repRange)) return number(planned.repRange[1]);
  if (hasInputValue(planned.repMax)) return number(planned.repMax);
  if (hasInputValue(planned.targetReps)) return number(planned.targetReps);
  if (hasInputValue(planned.plannedReps)) return number(planned.plannedReps);
  if (hasInputValue(planned.reps)) return number(planned.reps);
  return undefined;
};

const isNearPlannedWeight = (draftWeightKg?: number, plannedKg?: number) => {
  if (!draftWeightKg || !plannedKg || plannedKg <= 0) return false;
  const toleranceKg = Math.max(1, plannedKg * 0.03);
  return Math.abs(draftWeightKg - plannedKg) <= toleranceKg;
};

const workingWeightReference = (previousSets: TrainingSetLog[] = [], planned?: PlannedPrescriptionLike | null, displayUnit: WeightUnit = 'kg') => {
  const plannedWorking = plannedWeightKg(planned, displayUnit);
  if (plannedWorking && !isWarmupLike(planned)) return plannedWorking;
  const previousWorking = [...previousSets].reverse().find(reliableWorkSet);
  return previousWorking ? setWeightKg(previousWorking) : plannedWorking;
};

const detectUnitMismatch = (draft: ResolvedDraft, baselineKg?: number): SetAnomaly[] => {
  const issues: SetAnomaly[] = [];
  if (!draft.weightKg || draft.weightKg <= 0) return issues;

  if (draft.displayUnit === 'lb' && draft.displayWeight !== undefined) {
    const expectedKg = parseDisplayWeightToKg(draft.displayWeight, 'lb');
    const mismatch = Math.abs(draft.weightKg - expectedKg);
    if (draft.weightKg >= 100 && mismatch >= Math.max(10, expectedKg * 0.25)) {
      issues.push(anomaly({
        id: 'unit-lb-saved-as-kg',
        severity: 'critical',
        title: '重量单位可能输错',
        message: `当前单位是 lb，但这组重量保存接近 ${Math.round(draft.weightKg)}kg，像是把 ${Math.round(draft.displayWeight)}lb 当成公斤记录。`,
        suggestedAction: '请确认重量单位；如果实际是磅，请按 lb 重新输入后再保存。',
      }));
    }
  }

  if (draft.displayUnit === 'kg' && baselineKg && draft.weightKg > baselineKg * 1.5) {
    const lbAsKg = convertLbToKg(draft.weightKg);
    if (Math.abs(lbAsKg - baselineKg) <= Math.max(8, baselineKg * 0.2)) {
      issues.push(anomaly({
        id: 'unit-kg-looks-like-lb',
        severity: 'critical',
        title: '重量可能把磅数填进公斤',
        message: `当前单位是 kg，但输入值换算成 lb 后更接近近期记录。请确认是否把磅数当成公斤输入。`,
        suggestedAction: '确认后再保存；如果实际是磅，请切换单位或重新输入。',
      }));
    }
  }

  return issues;
};

export const detectSetAnomalies = ({
  currentDraft = null,
  exerciseId,
  previousSets = [],
  recentHistory = [],
  currentSessionId,
  unitSettings = DEFAULT_UNIT_SETTINGS,
  plannedPrescription = null,
}: DetectSetAnomaliesInput): SetAnomaly[] => {
  const draft = resolveDraft(currentDraft, unitSettings, plannedPrescription);
  const issues: SetAnomaly[] = [];
  const latestSet = latestPreviousSet(exerciseId, previousSets, recentHistory, currentSessionId);
  const historyBaselineKg = latestSet ? setWeightKg(latestSet) : undefined;
  const plannedKg = plannedWeightKg(plannedPrescription, draft.displayUnit);
  const baselineKg = historyBaselineKg ?? plannedKg;
  const repMax = plannedRepMax(plannedPrescription);
  const matchesPlannedWeight = isNearPlannedWeight(draft.weightKg, plannedKg);
  const draftSource = currentDraft?.source;

  if (!draft.hasWeightInput && !draft.hasRepsInput) {
    issues.push(anomaly({
      id: 'empty-set-complete',
      severity: 'critical',
      title: '这一组还没有记录',
      message: '重量和次数都为空时点击完成，可能是误触。保存前需要确认。',
      suggestedAction: '补充重量和次数，或确认这是一组特殊记录。',
    }));
  }

  if ((draft.weightKg ?? 0) === 0 && (draft.reps ?? 0) > 0 && !draft.isWarmup) {
    issues.push(anomaly({
      id: 'working-weight-zero-with-reps',
      severity: 'critical',
      title: '正式组重量为 0',
      message: '正式组记录了次数，但重量为 0。除非是明确的自重动作，否则这通常是漏填重量。',
      suggestedAction: '请确认重量后再保存。',
    }));
  }

  if (draft.weightKg && historyBaselineKg && draft.weightKg > historyBaselineKg * 1.5 && !matchesPlannedWeight) {
    issues.push(anomaly({
      id: 'weight-jump-over-50-percent',
      severity: draft.weightKg >= historyBaselineKg * 2 ? 'critical' : 'warning',
      title: '重量比近期记录高很多',
      message: `本组重量比上次同动作高出超过 50%。这可能是正常突破，也可能是输入错误。`,
      suggestedAction: '确认重量和单位后再保存。',
    }));
  }

  if (!matchesPlannedWeight) {
    issues.push(...detectUnitMismatch(draft, baselineKg));
  }

  if (draft.reps !== undefined && draft.reps > 50) {
    issues.push(anomaly({
      id: 'reps-over-50',
      severity: 'critical',
      title: '次数异常偏高',
      message: '本组次数超过 50 次，常见原因是多输入了一个数字。',
      suggestedAction: '请确认次数是否正确，例如 8 是否误填为 80。',
    }));
  } else if (draft.reps !== undefined && repMax && draft.reps > Math.max(repMax * 2, repMax + 10)) {
    issues.push(anomaly({
      id: 'reps-far-above-plan',
      severity: 'warning',
      title: '次数明显高于计划',
      message: '本组次数明显高于推荐上限。可以继续保存，但建议确认是否填错。',
      suggestedAction: '确认次数是否为真实完成次数。',
      requiresConfirmation: false,
    }));
  }

  if (draft.rir !== undefined && (draft.rir > 10 || draft.rir < 0)) {
    issues.push(anomaly({
      id: 'rir-out-of-range',
      severity: 'critical',
      title: '余力（RIR）数值异常',
      message: 'RIR 应记录为 0 到 10 之间的余力估计。当前数值超出合理范围。',
      suggestedAction: '请重新填写 RIR，或留空表示未记录。',
    }));
  }

  if (draft.isWarmup && draft.weightKg) {
    const workingReference = workingWeightReference(previousSets, plannedPrescription, draft.displayUnit);
    if (workingReference && draft.weightKg > workingReference * 1.1) {
      issues.push(anomaly({
        id: 'warmup-heavier-than-working',
        severity: draft.weightKg > workingReference * 1.25 ? 'critical' : 'warning',
        title: '热身组重量过高',
        message: '这组标记为热身组，但重量明显高于正式组参考重量。请确认是否选错了组类型。',
        suggestedAction: '如果这是正式组，请切换为正式组；如果是热身组，请确认重量。',
      }));
    }
  }

  if (draft.weightKg && plannedKg && plannedKg > 0) {
    const ratio = draft.weightKg / plannedKg;
    const copyPreviousNeedsConfirmation = draftSource === 'copy_previous' && (ratio >= 2.5 || ratio <= 0.25);
    const shouldReportPlanDiff = draftSource === 'copy_previous' ? copyPreviousNeedsConfirmation : ratio >= 1.5 || ratio <= 0.5;
    if (shouldReportPlanDiff) {
      issues.push(anomaly({
        id: 'planned-weight-large-diff',
        severity: 'warning',
        title: '重量和计划差异较大',
        message: '本组重量和计划重量差异较大。系统不会自动阻止保存，但建议先确认。',
        suggestedAction: '确认这是主动调整，而不是单位或输入错误。',
        requiresConfirmation: true,
      }));
    }
  }

  const byId = new Map<string, SetAnomaly>();
  issues.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
};
