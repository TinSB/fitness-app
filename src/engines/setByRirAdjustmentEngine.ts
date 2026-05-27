import { clamp, number } from './engineUtils';

// Feature #2: After every completed work set, compare actual RIR vs the
// target window and propose a small in-session weight delta (2.5 kg steps)
// to land the next set inside the target RIR window. The progressionRules
// engine handles inter-session strategy; this engine is strictly intra-
// session, run between sets while the user is still on the same exercise.

const PLATE_KG = 2.5;
const MAX_DELTA_PLATES = 2;

export type SetByRirAdjustmentInput = {
  completedWeightKg: number;
  completedReps: number;
  actualRir: number | null;
  targetRirMin: number;
  targetRirMax: number;
  exerciseKind?: 'compound' | 'isolation' | 'machine';
};

export type SetByRirAdjustmentResult = {
  deltaKg: number;
  nextSuggestedWeightKg: number;
  direction: 'increase' | 'decrease' | 'hold';
  reason:
    | 'rir_too_low'
    | 'rir_too_high'
    | 'within_target'
    | 'missing_actual_rir'
    | 'completed_weight_invalid';
};

export const buildSetByRirAdjustment = (
  input: SetByRirAdjustmentInput,
): SetByRirAdjustmentResult => {
  const completedWeight = number(input.completedWeightKg);
  if (completedWeight <= 0) {
    return {
      deltaKg: 0,
      nextSuggestedWeightKg: 0,
      direction: 'hold',
      reason: 'completed_weight_invalid',
    };
  }
  if (input.actualRir === null || input.actualRir === undefined || !Number.isFinite(input.actualRir)) {
    return {
      deltaKg: 0,
      nextSuggestedWeightKg: completedWeight,
      direction: 'hold',
      reason: 'missing_actual_rir',
    };
  }

  const targetMin = Math.min(input.targetRirMin, input.targetRirMax);
  const targetMax = Math.max(input.targetRirMin, input.targetRirMax);
  const actualRir = input.actualRir;

  const within = actualRir >= targetMin && actualRir <= targetMax;
  if (within) {
    return {
      deltaKg: 0,
      nextSuggestedWeightKg: completedWeight,
      direction: 'hold',
      reason: 'within_target',
    };
  }

  // Isolation lifts get a finer adjustment; compound lifts ladder more
  // aggressively because the user usually has enough headroom to absorb a
  // 5 kg jump on the next set without form deterioration.
  const stepKg = input.exerciseKind === 'isolation' ? PLATE_KG : PLATE_KG;
  const rawDelta = (actualRir - (targetMin + targetMax) / 2) * stepKg;
  const cappedDelta = clamp(rawDelta, -MAX_DELTA_PLATES * stepKg, MAX_DELTA_PLATES * stepKg);
  const roundedDelta = Math.sign(cappedDelta) * Math.round(Math.abs(cappedDelta) / PLATE_KG) * PLATE_KG;
  const next = Math.max(PLATE_KG, completedWeight + roundedDelta);

  return {
    deltaKg: roundedDelta,
    nextSuggestedWeightKg: next,
    direction: roundedDelta > 0 ? 'increase' : roundedDelta < 0 ? 'decrease' : 'hold',
    reason: actualRir < targetMin ? 'rir_too_low' : 'rir_too_high',
  };
};
