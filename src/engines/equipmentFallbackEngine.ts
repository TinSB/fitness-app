import type { ExerciseMetadata, MuscleGroup } from '../models/training-model';

// Feature #25: When a piece of equipment is unavailable mid-session (gym
// crowded, broken machine, deload week with home equipment), surface the
// top 3 alternative exercises that hit the same primary muscle with the
// closest movement pattern. The ranking favours:
//
//   1. Same equivalence chain — explicit "this is the same lift" mapping.
//   2. Same movement pattern + overlapping primary muscles.
//   3. Same primary muscle + comparable fatigue cost (so a high-fatigue
//      compound is not swapped for a tiny isolation move).
//
// This is a pure ranker — the caller decides whether to surface it as a
// chip / long-press menu / detail page.

export type EquipmentFallbackCandidate = {
  exerciseId: string;
  primaryMuscles: MuscleGroup[];
  movementPattern?: string;
  equivalenceChainId?: string;
  fatigueCost?: ExerciseMetadata['fatigueCost'];
  skillDemand?: ExerciseMetadata['skillDemand'];
  alternativePriorities?: ExerciseMetadata['alternativePriorities'];
};

export type EquipmentFallbackInput = {
  unavailable: EquipmentFallbackCandidate;
  library: EquipmentFallbackCandidate[];
  topK?: number;
};

export type EquipmentFallbackEntry = {
  exerciseId: string;
  score: number;
  reason:
    | 'same_equivalence_chain'
    | 'explicit_priority_priority'
    | 'explicit_priority_acceptable'
    | 'movement_pattern_match'
    | 'primary_muscle_match'
    | 'fallback';
};

export type EquipmentFallbackResult = {
  entries: EquipmentFallbackEntry[];
};

const MUSCLE_OVERLAP_BOOST = 30;
const PATTERN_BOOST = 25;
const CHAIN_BOOST = 60;
const FATIGUE_PENALTY = 10;

const PRIORITY_BOOST: Record<string, number> = {
  priority: 55,
  acceptable: 40,
  angle: 25,
  optional: 15,
  equipment_fallback: 50,
  fatigue_reduction: 20,
  compound_fallback: 35,
};

const overlapCount = <T,>(a: ReadonlyArray<T> = [], b: ReadonlyArray<T> = []) => {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
};

const fatigueDelta = (a?: ExerciseMetadata['fatigueCost'], b?: ExerciseMetadata['fatigueCost']) => {
  const rank: Record<NonNullable<ExerciseMetadata['fatigueCost']>, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  if (!a || !b) return 0;
  return Math.abs(rank[a] - rank[b]);
};

export const buildEquipmentFallback = (
  input: EquipmentFallbackInput,
): EquipmentFallbackResult => {
  const topK = input.topK ?? 3;
  const target = input.unavailable;
  const candidates = input.library.filter((c) => c.exerciseId !== target.exerciseId);

  const scored: EquipmentFallbackEntry[] = candidates.map((c) => {
    let score = 0;
    let reason: EquipmentFallbackEntry['reason'] = 'fallback';

    if (target.equivalenceChainId && c.equivalenceChainId === target.equivalenceChainId) {
      score += CHAIN_BOOST;
      reason = 'same_equivalence_chain';
    }
    const priorityEntry = (target.alternativePriorities as { exerciseId: string; rank?: string }[] | undefined)?.find(
      (p) => p.exerciseId === c.exerciseId,
    );
    if (priorityEntry?.rank && PRIORITY_BOOST[priorityEntry.rank]) {
      score += PRIORITY_BOOST[priorityEntry.rank];
      if (priorityEntry.rank === 'priority') reason = 'explicit_priority_priority';
      else if (priorityEntry.rank === 'acceptable') reason = 'explicit_priority_acceptable';
    }
    if (target.movementPattern && c.movementPattern === target.movementPattern) {
      score += PATTERN_BOOST;
      if (reason === 'fallback') reason = 'movement_pattern_match';
    }
    const muscleHits = overlapCount(target.primaryMuscles, c.primaryMuscles);
    if (muscleHits > 0) {
      score += muscleHits * MUSCLE_OVERLAP_BOOST;
      if (reason === 'fallback') reason = 'primary_muscle_match';
    }
    score -= fatigueDelta(target.fatigueCost, c.fatigueCost) * FATIGUE_PENALTY;

    return { exerciseId: c.exerciseId, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  return { entries: scored.filter((e) => e.score > 0).slice(0, topK) };
};
