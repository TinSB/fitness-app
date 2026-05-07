import { formatExerciseName } from '../i18n/formatters';
import type { ExercisePrescription, TrainingSession, TrainingSetLog } from '../models/training-model';
import { number, setWeightKg } from './engineUtils';
import { evaluateEffectiveSet } from './effectiveSetEngine';
import { hasInvalidExerciseIdentity } from './replacementEngine';

export type EffectiveSetExplanationReason =
  | 'warmup'
  | 'incomplete'
  | 'missing_weight_or_reps'
  | 'rir_missing'
  | 'poor_technique'
  | 'pain_flag'
  | 'identity_invalid'
  | 'test_or_excluded'
  | 'not_enough_effort'
  | 'unsupported_set_type';

export type EffectiveSetCountedSet = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  reason: string;
};

export type EffectiveSetExcludedSet = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  reasonCode: EffectiveSetExplanationReason;
  reason: string;
  /** @deprecated Use reasonCode. Kept for existing tests and UI code. */
  reasonKey: EffectiveSetExplanationReason;
};

export type EffectiveSetExplanation = {
  completedWorkingSets: number;
  /** @deprecated Use completedWorkingSets. */
  totalCompletedWorkingSets: number;
  countedEffectiveSets: number;
  excludedSetCount: number;
  countedSets: EffectiveSetCountedSet[];
  excludedSets: EffectiveSetExcludedSet[];
  summary: string;
};

export const EFFECTIVE_SET_EXPLANATION_REASON_LABELS: Record<EffectiveSetExplanationReason, string> = {
  warmup: '热身组不计入有效组。',
  incomplete: '该组未完成，不计入有效组。',
  missing_weight_or_reps: '该组缺少重量或次数，无法判断训练刺激。',
  rir_missing: '该组 RIR 记录不完整，置信度较低。',
  poor_technique: '动作质量较低，未作为高质量有效组。',
  pain_flag: '该组标记了不适，系统不会作为高质量刺激。',
  identity_invalid: '动作身份需要检查，暂不进入有效组统计。',
  test_or_excluded: '该训练被标记为测试或排除，不参与默认统计。',
  not_enough_effort: '该组距离力竭较远，未达到有效组标准。',
  unsupported_set_type: '该组类型不参与有效组统计。',
};

const COUNTED_SET_REASON = '符合有效组条件。';
const NON_WORKING_SET_TYPES = new Set(['support', 'corrective', 'correction', 'functional']);

const setTypeText = (set: TrainingSetLog) => String(set.type || '').trim().toLowerCase();

const isWarmupSet = (set: TrainingSetLog) => setTypeText(set) === 'warmup' || String(set.id || '').includes(':warmup:');

const isUnsupportedSetType = (set: TrainingSetLog) => {
  const type = setTypeText(set);
  return Boolean(type && NON_WORKING_SET_TYPES.has(type));
};

const isWorkingCandidateSet = (set: TrainingSetLog) => !isWarmupSet(set) && !isUnsupportedSetType(set);

const hasUsableLoadAndReps = (set: TrainingSetLog) => setWeightKg(set) > 0 && number(set.reps) > 0;

const exerciseIdentity = (exercise: Partial<ExercisePrescription>) =>
  new Set(
    [
      exercise.id,
      exercise.actualExerciseId,
      exercise.replacementExerciseId,
      exercise.originalExerciseId,
      exercise.baseId,
      exercise.canonicalExerciseId,
    ]
      .filter(Boolean)
      .map(String),
  );

const displayExerciseId = (exercise: Partial<ExercisePrescription>, fallback?: string) =>
  String(exercise.actualExerciseId || exercise.replacementExerciseId || exercise.id || fallback || 'unknown-exercise');

const parseWarmupExerciseId = (set: TrainingSetLog) => {
  const explicit = String((set as TrainingSetLog & { exerciseId?: unknown }).exerciseId || '').trim();
  if (explicit) return explicit;
  const match = String(set.id || '').match(/^main:([^:]+):warmup:/);
  return match?.[1] || '';
};

const findExerciseForSet = (session: TrainingSession, exerciseId: string) =>
  (session.exercises || []).find((exercise) => exerciseIdentity(exercise).has(exerciseId));

const displayExerciseName = (exercise: Partial<ExercisePrescription> | undefined, fallbackId?: string) => {
  if (exercise) return formatExerciseName(exercise);
  if (fallbackId) return formatExerciseName(fallbackId);
  return '热身组';
};

const reasonForSet = (
  session: TrainingSession,
  exercise: Partial<ExercisePrescription>,
  set: TrainingSetLog,
): EffectiveSetExplanationReason | null => {
  if (isWarmupSet(set)) return 'warmup';
  if (isUnsupportedSetType(set)) return 'unsupported_set_type';
  if (set.done !== true) return 'incomplete';
  if (!hasUsableLoadAndReps(set)) return 'missing_weight_or_reps';
  if (hasInvalidExerciseIdentity(exercise) || set.identityInvalid) return 'identity_invalid';
  if (session.dataFlag === 'test' || session.dataFlag === 'excluded') return 'test_or_excluded';

  const result = evaluateEffectiveSet(set, exercise);
  if (result.isEffective) return null;
  if (result.flags.includes('pain')) return 'pain_flag';
  if (result.flags.includes('poor_technique')) return 'poor_technique';
  if (result.flags.includes('unknown_rir')) return 'rir_missing';
  return 'not_enough_effort';
};

const countedRow = (exercise: Partial<ExercisePrescription>, setIndex: number): EffectiveSetCountedSet => ({
  exerciseId: displayExerciseId(exercise),
  exerciseName: displayExerciseName(exercise),
  setIndex,
  reason: COUNTED_SET_REASON,
});

const excludedRow = (
  exercise: Partial<ExercisePrescription> | undefined,
  setIndex: number,
  reasonCode: EffectiveSetExplanationReason,
  fallbackExerciseId?: string,
): EffectiveSetExcludedSet => ({
  exerciseId: displayExerciseId(exercise || {}, fallbackExerciseId),
  exerciseName: displayExerciseName(exercise, fallbackExerciseId),
  setIndex,
  reasonCode,
  reasonKey: reasonCode,
  reason: EFFECTIVE_SET_EXPLANATION_REASON_LABELS[reasonCode],
});

const buildSummary = ({ completedWorkingSets, countedEffectiveSets }: Pick<EffectiveSetExplanation, 'completedWorkingSets' | 'countedEffectiveSets'>) => {
  if (completedWorkingSets <= 0) return '本次没有已完成正式组，因此没有计入有效组。';
  if (countedEffectiveSets === completedWorkingSets) return `${completedWorkingSets} 个已完成正式组全部计入有效组。`;
  return `${completedWorkingSets} 个已完成正式组中，${countedEffectiveSets} 个计入有效组。`;
};

export const buildEffectiveSetExplanation = (session: TrainingSession): EffectiveSetExplanation => {
  const countedSets: EffectiveSetCountedSet[] = [];
  const excludedSets: EffectiveSetExcludedSet[] = [];
  let completedWorkingSets = 0;

  (session.exercises || []).forEach((exercise) => {
    (Array.isArray(exercise.sets) ? exercise.sets : []).forEach((set, index) => {
      const setIndex = index + 1;
      const reasonCode = reasonForSet(session, exercise, set);
      const isCompletedWorkingSet = isWorkingCandidateSet(set) && set.done === true && hasUsableLoadAndReps(set);
      if (isCompletedWorkingSet) completedWorkingSets += 1;
      if (!reasonCode && isCompletedWorkingSet) {
        countedSets.push(countedRow(exercise, setIndex));
      } else if (reasonCode) {
        excludedSets.push(excludedRow(exercise, setIndex, reasonCode));
      }
    });
  });

  (session.focusWarmupSetLogs || []).forEach((set, index) => {
    const exerciseId = parseWarmupExerciseId(set);
    excludedSets.push(excludedRow(findExerciseForSet(session, exerciseId), index + 1, 'warmup', exerciseId || undefined));
  });

  const countedEffectiveSets = countedSets.length;
  return {
    completedWorkingSets,
    totalCompletedWorkingSets: completedWorkingSets,
    countedEffectiveSets,
    excludedSetCount: excludedSets.length,
    countedSets,
    excludedSets,
    summary: buildSummary({ completedWorkingSets, countedEffectiveSets }),
  };
};
