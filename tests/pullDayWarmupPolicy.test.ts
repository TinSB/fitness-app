import { describe, expect, it } from 'vitest';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { decideWarmupPolicy } from '../src/engines/warmupPolicyEngine';
import type { ExercisePrescription } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const firstSetWeight = (exercise: ExercisePrescription) =>
  Array.isArray(exercise.sets) ? Number(exercise.sets[0]?.weight ?? exercise.startWeight) : Number(exercise.startWeight);

const buildPullSession = () => {
  const data = makeAppData();
  const pull = getTemplate('pull-a');
  return createSession(
    pull,
    data.todayStatus,
    data.history,
    data.trainingMode,
    null,
    null,
    data.screeningProfile,
    data.mesocyclePlan,
  );
};

const stepsFor = (exerciseId: string) => buildFocusStepQueue(buildPullSession()).filter((step) => step.exerciseId === exerciseId);
const workingSetCountFor = (exerciseId: string) => {
  const exercise = buildPullSession().exercises.find((item) => item.id === exerciseId);
  return Array.isArray(exercise?.sets) ? exercise.sets.length : 0;
};

describe('Pull day warmup policy', () => {
  it('uses a full warmup for the first lat pulldown', () => {
    const latSteps = stepsFor('lat-pulldown');
    const warmups = latSteps.filter((step) => step.stepType === 'warmup');

    expect(warmups.length).toBeGreaterThan(1);
    expect(warmups.every((step) => step.warmupPolicy?.warmupDecision === 'full_warmup')).toBe(true);
    expect(latSteps.some((step) => step.stepType === 'working')).toBe(true);
  });

  it('does not repeat a full warmup for seated row after lat pulldown', () => {
    const seatedSteps = stepsFor('seated-row');

    expect(seatedSteps.some((step) => step.stepType === 'warmup')).toBe(false);
    expect(seatedSteps.filter((step) => step.stepType === 'working')).toHaveLength(workingSetCountFor('seated-row'));
    expect(seatedSteps[0].warmupPolicy?.warmupDecision).toBe('no_warmup');
    expect(seatedSteps[0].warmupPolicy?.reason).toContain('相关肌群');
  });

  it('keeps only one feeder set for barbell row', () => {
    const barbellSteps = stepsFor('barbell-row');
    const warmups = barbellSteps.filter((step) => step.stepType === 'warmup');

    expect(warmups).toHaveLength(1);
    expect(warmups[0].label).toContain('适应组');
    expect(warmups[0].warmupPolicy?.warmupDecision).toBe('feeder_set');
    expect(warmups[0].warmupPolicy?.reason).toContain('1 组适应组');
    expect(barbellSteps.filter((step) => step.stepType === 'working')).toHaveLength(workingSetCountFor('barbell-row'));
  });

  it('does not add warmups for face pull and curls', () => {
    expect(stepsFor('face-pull').some((step) => step.stepType === 'warmup')).toBe(false);
    expect(stepsFor('db-curl').some((step) => step.stepType === 'warmup')).toBe(false);
    expect(stepsFor('hammer-curl').some((step) => step.stepType === 'warmup')).toBe(false);
  });

  it('allows barbell row to use full warmup when it is the first main exercise', () => {
    const session = buildPullSession();
    const barbell = session.exercises.find((exercise) => exercise.id === 'barbell-row') as ExercisePrescription;
    const decision = decideWarmupPolicy({
      exercise: barbell,
      exerciseIndex: 0,
      plannedWeight: firstSetWeight(barbell),
    });

    expect(decision.warmupDecision).toBe('full_warmup');
    expect(decision.shouldShowWarmupSets).toBe(true);
  });

  it('keeps replacement-style same-muscle pulls from becoming another full warmup', () => {
    const session = buildPullSession();
    const lat = session.exercises.find((exercise) => exercise.id === 'lat-pulldown') as ExercisePrescription;
    const oneArmRow = {
      ...(session.exercises.find((exercise) => exercise.id === 'seated-row') as ExercisePrescription),
      id: 'one-arm-db-row',
      actualExerciseId: 'one-arm-db-row',
      replacementExerciseId: 'one-arm-db-row',
      originalExerciseId: 'seated-row',
      sameTemplateSlot: true,
      prIndependent: true,
    } as ExercisePrescription;
    const decision = decideWarmupPolicy({
      exercise: oneArmRow,
      exerciseIndex: 1,
      previousExercises: [lat],
      plannedWeight: firstSetWeight(oneArmRow),
    });

    expect(decision.warmupDecision).not.toBe('full_warmup');
  });
});
