import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { completedSets, isCompletedSet, number, sessionCompletedSets, sessionVolume, setVolume } from './engineUtils';

export interface SessionTopSet {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
}

export interface SessionPostSummary {
  sessionId: string;
  date: string;
  templateId?: string;
  templateName?: string;
  totalCompletedSets: number;
  totalVolumeKg: number;
  topSet?: SessionTopSet;
  musclesTouched: string[];
  comparison?: {
    previousSessionId: string;
    previousDate: string;
    setsDelta: number;
    volumeDeltaKg: number;
    topSetDeltaKg?: number;
    direction: 'up' | 'flat' | 'down';
  };
  highlights: string[];
}

const findTopSet = (session: TrainingSession): SessionTopSet | undefined => {
  let best: SessionTopSet | undefined;
  (session.exercises || []).forEach((exercise) => {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    sets.filter(isCompletedSet).forEach((set: TrainingSetLog) => {
      const weight = number(set.actualWeightKg ?? set.weight);
      const reps = number(set.reps);
      if (weight <= 0 || reps <= 0) return;
      if (!best || weight > best.weightKg || (weight === best.weightKg && reps > best.reps)) {
        best = {
          exerciseId: exercise.baseId || exercise.id,
          exerciseName: exercise.name || exercise.id,
          weightKg: weight,
          reps,
        };
      }
    });
  });
  return best;
};

const musclesFromSession = (session: TrainingSession): string[] => {
  const seen = new Set<string>();
  (session.exercises || []).forEach((exercise) => {
    if (!completedSets(exercise).length) return;
    const primary = exercise.muscle;
    if (primary) seen.add(primary);
    (exercise.primaryMuscles || []).forEach((muscle) => muscle && seen.add(muscle));
  });
  return [...seen];
};

const findComparable = (history: TrainingSession[], current: TrainingSession): TrainingSession | undefined => {
  if (!current.templateId) return undefined;
  return history.find(
    (entry) =>
      entry.id !== current.id &&
      entry.templateId === current.templateId &&
      entry.completed !== false &&
      entry.dataFlag !== 'test' &&
      entry.dataFlag !== 'excluded' &&
      sessionCompletedSets(entry) > 0,
  );
};

const buildHighlights = (
  current: SessionPostSummary,
  previousVolume: number | null,
  previousTopWeight: number | null,
): string[] => {
  const highlights: string[] = [];
  if (current.totalCompletedSets === 0) {
    highlights.push('本次没有完成组，建议下次先把基础组数补回来。');
    return highlights;
  }
  if (current.topSet) {
    highlights.push(`今天最重一组：${current.topSet.exerciseName} ${current.topSet.weightKg}kg × ${current.topSet.reps}。`);
  }
  if (current.musclesTouched.length) {
    highlights.push(`覆盖肌群：${current.musclesTouched.join(' / ')}。`);
  }
  if (previousVolume !== null) {
    const delta = current.totalVolumeKg - previousVolume;
    if (delta > 0) highlights.push(`比上次同模板多 ${Math.round(delta)}kg 总训练量。`);
    else if (delta < 0) highlights.push(`比上次同模板少 ${Math.round(-delta)}kg 总训练量，注意恢复或下次跟进。`);
    else highlights.push('与上次同模板总训练量持平。');
  }
  if (previousTopWeight !== null && current.topSet) {
    const diff = current.topSet.weightKg - previousTopWeight;
    if (diff > 0) highlights.push(`顶组重量比上次提升 ${diff.toFixed(1)}kg。`);
    else if (diff < 0) highlights.push(`顶组重量比上次轻 ${(-diff).toFixed(1)}kg。`);
  }
  return highlights;
};

export const buildSessionPostSummary = (session: TrainingSession, history: TrainingSession[] = []): SessionPostSummary => {
  const totalCompletedSets = sessionCompletedSets(session);
  const totalVolumeKg = (session.exercises || []).reduce(
    (sum, exercise) => sum + completedSets(exercise).reduce((volume, set) => volume + setVolume(set), 0),
    0,
  );
  const topSet = findTopSet(session);
  const musclesTouched = musclesFromSession(session);

  const previous = findComparable(history, session);
  let comparison: SessionPostSummary['comparison'] | undefined;
  let previousVolume: number | null = null;
  let previousTopWeight: number | null = null;

  if (previous) {
    previousVolume = sessionVolume(previous);
    const previousTop = findTopSet(previous);
    previousTopWeight = previousTop?.weightKg ?? null;
    const setsDelta = totalCompletedSets - sessionCompletedSets(previous);
    const volumeDeltaKg = Math.round(totalVolumeKg - previousVolume);
    const direction: 'up' | 'flat' | 'down' = volumeDeltaKg > 0 ? 'up' : volumeDeltaKg < 0 ? 'down' : 'flat';
    comparison = {
      previousSessionId: previous.id,
      previousDate: previous.date,
      setsDelta,
      volumeDeltaKg,
      topSetDeltaKg: previousTop && topSet ? Number((topSet.weightKg - previousTop.weightKg).toFixed(1)) : undefined,
      direction,
    };
  }

  const summary: SessionPostSummary = {
    sessionId: session.id,
    date: session.date,
    templateId: session.templateId,
    templateName: session.templateName,
    totalCompletedSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    topSet,
    musclesTouched,
    comparison,
    highlights: [],
  };

  summary.highlights = buildHighlights(summary, previousVolume, previousTopWeight);
  return summary;
};
