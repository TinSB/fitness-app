import { describe, expect, it } from 'vitest';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { decideWarmupPolicy } from '../src/engines/warmupPolicyEngine';
import type { ExercisePrescription } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const firstPlannedWeight = (exercise: ExercisePrescription) =>
  Array.isArray(exercise.sets) ? Number(exercise.sets[0]?.weight ?? exercise.startWeight) : Number(exercise.startWeight);

const buildPullSession = () => {
  const data = makeAppData();
  return createSession(
    getTemplate('pull-a'),
    data.todayStatus,
    data.history,
    data.trainingMode,
    null,
    null,
    data.screeningProfile,
    data.mesocyclePlan,
  );
};

const exerciseById = (id: string) => {
  const exercise = buildPullSession().exercises.find((item) => item.id === id);
  if (!exercise) throw new Error(`Missing exercise ${id}`);
  return exercise;
};

describe('focus warmup queue', () => {
  it('does not generate warmup steps for seated row after lat pulldown', () => {
    const steps = buildFocusStepQueue(buildPullSession()).filter((step) => step.exerciseId === 'seated-row');

    expect(steps.some((step) => step.stepType === 'warmup')).toBe(false);
    expect(steps[0]?.warmupPolicy?.warmupDecision).toBe('no_warmup');
    expect(steps.map((step) => step.label).join('\n')).not.toMatch(/1\s*\/\s*5/);
  });

  it('uses one feeder set for barbell row instead of a full warmup block', () => {
    const steps = buildFocusStepQueue(buildPullSession()).filter((step) => step.exerciseId === 'barbell-row');
    const warmups = steps.filter((step) => step.stepType === 'warmup');

    expect(warmups).toHaveLength(1);
    expect(warmups[0].warmupPolicy?.warmupDecision).toBe('feeder_set');
    expect(warmups[0].totalSetsForStepType).toBe(1);
    expect(warmups[0].label).not.toMatch(/1\s*\/\s*5/);
  });

  it('keeps working set counts unchanged while reducing repeated warmups', () => {
    const session = buildPullSession();
    const queue = buildFocusStepQueue(session);

    for (const exercise of session.exercises) {
      const plannedWorkingSets = Array.isArray(exercise.sets) ? exercise.sets.length : Number(exercise.sets || 0);
      const queuedWorkingSets = queue.filter((step) => step.exerciseId === exercise.id && step.stepType === 'working').length;
      expect(queuedWorkingSets).toBe(plannedWorkingSets);
    }
  });

  it('treats vertical and horizontal pull as the same warmup family for later stable rows', () => {
    const latPulldown = exerciseById('lat-pulldown');
    const seatedRow = exerciseById('seated-row');
    const decision = decideWarmupPolicy({
      exercise: seatedRow,
      exerciseIndex: 1,
      warmupContext: {
        exerciseIndex: 1,
        previousExercises: [latPulldown],
        previousWarmupDecisions: ['full_warmup'],
        warmedMuscles: latPulldown.primaryMuscles || [],
        warmedMovementPatterns: ['vertical_pull'],
      },
      plannedWeight: firstPlannedWeight(seatedRow),
    });

    expect(decision.warmupDecision).toBe('no_warmup');
    expect(decision.shouldShowWarmupSets).toBe(false);
  });
});
