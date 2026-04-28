import type { ExercisePrescription, ExerciseTemplate, PerformanceSnapshot, TrainingSession, TrainingSetLog } from '../models/training-model';
import { findPreviousPerformance, findRecentPerformances } from './adaptiveFeedbackEngine';
import { number, repsText, setVolume, weightText } from './engineUtils';

type ExerciseForProgression = Pick<
  ExerciseTemplate,
  'id' | 'name' | 'repMin' | 'repMax' | 'startWeight' | 'kind' | 'rest'
> & {
  baseId?: string;
  sets: number | TrainingSetLog[];
  targetRir?: [number, number];
  targetRirText?: string;
  progressionUnitKg?: number;
  progressionPercent?: [number, number];
  conservativeTopSet?: boolean;
  progressLocked?: boolean;
  replacementSuggested?: string;
  fatigueCost?: string;
  adaptiveTopSetFactor?: number;
  adaptiveBackoffFactor?: number;
  regressionIds?: string[];
};

type Suggestion = {
  weight: number;
  reps: number;
  lastSummary: string;
  targetSummary: string;
  note: string;
};

export const buildRecommendationDifferenceExplanation = () =>
  '同一模板下，推荐会因历史记录、训练等级、准备度、动作质量和单位设置不同而变化；“增肌”和“肌肥大”会归一为同一个肌肥大目标。';

const averageRir = (sets: TrainingSetLog[]) => {
  const values = sets.map((set) => Number(set.rir)).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const qualityRank = (quality?: TrainingSetLog['techniqueQuality']) => {
  if (quality === 'good') return 2;
  if (quality === 'acceptable') return 1;
  return 0;
};

const averageTechniqueQuality = (sets: TrainingSetLog[]) => {
  if (!sets.length) return 'acceptable' as const;
  const avg = sets.reduce((sum, set) => sum + qualityRank(set.techniqueQuality || 'acceptable'), 0) / sets.length;
  if (avg >= 1.5) return 'good' as const;
  if (avg < 0.75) return 'poor' as const;
  return 'acceptable' as const;
};

const hitRepCeiling = (performance: PerformanceSnapshot | null, exercise: ExerciseForProgression) =>
  Boolean(
    performance?.sets.length &&
      performance.sets.length >= number(exercise.sets) &&
      performance.sets.slice(0, number(exercise.sets)).every((set) => number(set.reps) >= number(exercise.repMax))
  );

const firstSetBelowFloor = (performance: PerformanceSnapshot | null, exercise: ExerciseForProgression) =>
  Boolean(performance?.sets?.length && number(performance.sets[0].reps) < number(exercise.repMin));

const rirAllowsProgress = (performance: PerformanceSnapshot | null, exercise: ExerciseForProgression) => {
  const avg = averageRir(performance?.sets || []);
  if (avg === null) return true;
  return avg >= (exercise.targetRir?.[0] ?? 1);
};

const roundToUnit = (value: number, unit: number) => Math.max(unit, Math.round(value / unit) * unit);
const roundLoad = (value: number, unit = 2.5) => Math.max(unit, Math.round(value / unit) * unit);

const progressionIncrement = (exercise: ExerciseForProgression, currentWeight: number) => {
  const unit = number(exercise.progressionUnitKg) || 1;
  const percent = (exercise.progressionPercent?.[0] || 5) / 100;
  return roundToUnit(Math.max(unit, currentWeight * percent), unit);
};

const summarizeRir = (sets: TrainingSetLog[]) => {
  const avg = averageRir(sets);
  return avg === null ? '' : ` / RIR ${avg.toFixed(1)}`;
};

const summarizeTechnique = (sets: TrainingSetLog[]) => {
  const quality = averageTechniqueQuality(sets);
  if (quality === 'good') return ' / 技术良好';
  if (quality === 'poor') return ' / 技术较差';
  return '';
};

const recentPoorTechniqueCount = (recent: PerformanceSnapshot[]) =>
  recent.filter((performance) => averageTechniqueQuality(performance.sets) === 'poor').length;

export const makeSuggestion = (templateExercise: ExerciseForProgression, history: TrainingSession[]): Suggestion => {
  const historyId = templateExercise.baseId || templateExercise.id;
  const recent = findRecentPerformances(history, historyId, 3);
  const last = recent[0];
  const conservativeBias = Boolean(templateExercise.conservativeTopSet || templateExercise.progressLocked);

  if (!last) {
    const rangeNote =
      templateExercise.kind === 'isolation' && number(templateExercise.repMax) >= 20
        ? ` ${templateExercise.repMin}-${templateExercise.repMax} 次是目标范围，不代表每组必须做到 ${templateExercise.repMax} 次；数据不足时先从 ${templateExercise.repMin}-${Math.min(number(templateExercise.repMin) + 2, number(templateExercise.repMax))} 次建立基线。`
        : '';
    return {
      weight: templateExercise.startWeight,
      reps: templateExercise.repMin,
      lastSummary: '暂无历史',
      targetSummary: `${weightText(templateExercise.startWeight)} x ${templateExercise.repMin}-${templateExercise.repMax} x ${templateExercise.sets} / ${templateExercise.targetRirText}`,
      note: conservativeBias
        ? `先建立基线，今天把第一组做保守一点，停在 ${templateExercise.targetRirText}。${rangeNote}`
        : `先建立基线，默认停在 ${templateExercise.targetRirText}。${rangeNote}`,
    };
  }

  const lastWeight = number(last.sets[0]?.weight || templateExercise.startWeight);
  const previous = recent[1] || findPreviousPerformance(history, historyId, last.session.id);
  const hitTop = hitRepCeiling(last, templateExercise);
  const previousHitTop = hitRepCeiling(previous, templateExercise);
  const lastVolume = last.sets.reduce((sum, set) => sum + setVolume(set), 0);
  const previousVolume = previous ? previous.sets.reduce((sum, set) => sum + setVolume(set), 0) : null;
  const dropped = Boolean(previousVolume && lastVolume < previousVolume * 0.9);
  const tooHard = firstSetBelowFloor(last, templateExercise) || !rirAllowsProgress(last, templateExercise);
  const increment = progressionIncrement(templateExercise, lastWeight);
  const lastTechnique = averageTechniqueQuality(last.sets);
  const previousTechnique = previous ? averageTechniqueQuality(previous.sets) : 'acceptable';
  const poorTechniqueStreak = recentPoorTechniqueCount(recent);

  const techniqueBlocksProgress = lastTechnique === 'poor';
  const techniqueSuggestsBackoff = poorTechniqueStreak >= 2 || (lastTechnique === 'poor' && previousTechnique === 'poor');
  const shouldAdd =
    hitTop && previousHitTop && !tooHard && !templateExercise.progressLocked && !templateExercise.conservativeTopSet && !techniqueBlocksProgress;
  const shouldBackoff = tooHard || dropped || techniqueSuggestsBackoff;

  let nextWeight = shouldBackoff
    ? Math.max(number(templateExercise.progressionUnitKg) || 1, lastWeight - increment)
    : shouldAdd
      ? lastWeight + increment
      : lastWeight;
  let nextReps = shouldAdd || shouldBackoff ? templateExercise.repMin : templateExercise.repMax;
  const avgRir = averageRir(last.sets);

  if (conservativeBias && !shouldBackoff && !shouldAdd) nextReps = templateExercise.repMin;
  if (templateExercise.conservativeTopSet && !shouldBackoff) nextWeight = lastWeight;

  const notes: string[] = [];
  if (shouldBackoff) {
    notes.push(
      techniqueSuggestsBackoff
        ? `最近两次动作质量都偏差，今天先退回到 ${weightText(nextWeight)}。`
        : `最近表现回落，今天先退回到 ${weightText(nextWeight)}。`
    );
  } else if (templateExercise.progressLocked) {
    notes.push('今天锁定推进，不加重，优先把动作做干净。');
  } else if (techniqueBlocksProgress) {
    notes.push('虽然次数达标，但动作质量较差，本次先不建议加重。');
  } else if (shouldAdd) {
    notes.push(`连续两次打满上限，今天加 ${increment}kg。`);
  } else if (hitTop) {
    notes.push('已经打到过一次上限，再稳一练再加重。');
  } else if (avgRir !== null && avgRir > (templateExercise.targetRir?.[1] ?? 3) + 1) {
    notes.push('RIR 还偏高，先把次数打满，再加重量。');
  } else {
    notes.push(`先把 ${weightText(lastWeight)} 稳定推进到目标次数上限。`);
  }

  if (poorTechniqueStreak >= 2 && templateExercise.regressionIds?.length) {
    notes.push(`如果下次技术质量还差，可以考虑回退到 ${templateExercise.regressionIds[0]}。`);
  }
  if (templateExercise.replacementSuggested) notes.push(`今天更建议换成 ${templateExercise.replacementSuggested}。`);

  return {
    weight: nextWeight,
    reps: nextReps,
    lastSummary: `${weightText(lastWeight)} x ${repsText(last.sets)}${summarizeRir(last.sets)}${summarizeTechnique(last.sets)}`,
    targetSummary: `${weightText(nextWeight)} x ${templateExercise.repMin}-${templateExercise.repMax} x ${templateExercise.sets} / ${templateExercise.targetRirText}`,
    note: notes.join(' '),
  };
};

export const shouldUseTopBackoff = (exercise: ExerciseForProgression) =>
  (exercise.kind === 'compound' || exercise.kind === 'machine') && number(exercise.sets) >= 3 && number(exercise.startWeight) >= 30;

export const buildSetPrescription = (
  exercise: ExerciseForProgression,
  suggestion: Pick<Suggestion, 'weight' | 'reps'>
) => {
  const unit = number(exercise.progressionUnitKg) || 2.5;
  const conservative = Boolean(exercise.conservativeTopSet);
  const adaptiveTopFactor = number(exercise.adaptiveTopSetFactor) || 1;
  const adaptiveBackoffFactor = number(exercise.adaptiveBackoffFactor) || 0.92;

  if (!shouldUseTopBackoff(exercise)) {
    const workingWeight = roundLoad((conservative ? suggestion.weight * 0.97 : suggestion.weight) * adaptiveTopFactor, unit);
    const workingReps = conservative ? Math.max(number(exercise.repMin), Math.min(number(suggestion.reps), number(exercise.repMin))) : suggestion.reps;
    return {
      topWeight: workingWeight,
      topReps: workingReps,
      backoffWeight: workingWeight,
      backoffReps: workingReps,
      summary: `${weightText(workingWeight)} x ${exercise.repMin}-${exercise.repMax} x ${exercise.sets}${conservative || adaptiveTopFactor < 1 ? ' / 保守版' : ''}`,
    };
  }

  const rawTopWeight = (conservative ? suggestion.weight * 0.96 : suggestion.weight) * adaptiveTopFactor;
  const topWeight = roundLoad(rawTopWeight, unit);
  const topReps = conservative ? Math.max(number(exercise.repMin), Math.min(number(suggestion.reps), number(exercise.repMin))) : suggestion.reps;
  const baseBackoffDrop = exercise.fatigueCost === 'high' ? 0.9 : 0.92;
  const conservativeDrop = conservative ? (exercise.fatigueCost === 'high' ? 0.86 : 0.88) : baseBackoffDrop;
  const backoffWeight = roundLoad(topWeight * Math.min(conservativeDrop, adaptiveBackoffFactor), unit);
  const backoffReps = conservative
    ? Math.max(number(exercise.repMin), Math.min(number(exercise.repMax), topReps + 1))
    : Math.min(number(exercise.repMax), Math.max(number(exercise.repMin), suggestion.reps + 1));

  return {
    topWeight,
    topReps,
    backoffWeight,
    backoffReps,
    summary: `顶组 ${weightText(topWeight)} x ${topReps}；回退 ${weightText(backoffWeight)} x ${Math.max(1, number(exercise.sets) - 1)}${conservative || adaptiveTopFactor < 1 || adaptiveBackoffFactor < 0.92 ? ' / 保守版' : ''}`,
  };
};

export const buildWarmupSets = (workWeight: number, exercise: ExerciseForProgression) => {
  const weight = number(workWeight);
  if (!weight || weight < 25) return [];

  const unit = number(exercise.progressionUnitKg) || 2.5;
  const ladder = [
    { ratio: 0, reps: 10, label: '空杆 / 极轻重量' },
    { ratio: 0.4, reps: 5 },
    { ratio: 0.6, reps: 3 },
    { ratio: 0.8, reps: 2 },
    { ratio: 0.9, reps: 1 },
  ];

  return ladder
    .map((item) => ({
      ...item,
      weight: item.ratio ? roundLoad(weight * item.ratio, unit) : Math.min(20, Math.max(unit, roundLoad(weight * 0.2, unit))),
    }))
    .filter((item, index, list) => item.weight < weight && (index === 0 || item.weight > list[index - 1].weight));
};
