import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, completeFocusSet, getCurrentFocusStep, switchFocusExercise } from '../src/engines/focusModeStateEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const patterned = (exercise: ExercisePrescription, pattern: string) =>
  ({
    ...exercise,
    movementPattern: pattern,
  }) as ExercisePrescription;

describe('switch focus exercise', () => {
  it('moves to the selected exercise first incomplete step without reusing the previous set index', () => {
    const bench = patterned(makeExercise('bench', 2), 'horizontal_push');
    const row = patterned({ ...makeExercise('row', 2, 0, 2), muscle: '背', primaryMuscles: ['背'] }, 'horizontal_pull');
    let session = makeFocusSession([bench, row]);
    session.currentFocusStepId = 'main:bench:working:1';
    session.currentSetIndex = 1;

    session = switchFocusExercise(session, 1);
    expect(getCurrentFocusStep(session).id).toBe('main:row:warmup:0');
    expect(getCurrentFocusStep(session).setIndex).toBe(0);
  });

  it('shows completed status when selected exercise has no incomplete steps', () => {
    const bench = makeExercise('bench', 1, 1);
    const row = makeExercise('row', 1);
    const session = switchFocusExercise(makeFocusSession([bench, row]), 0);

    const step = getCurrentFocusStep(session);
    expect(step.stepType).toBe('completed');
    expect(step.exerciseId).toBe('bench');
    expect(step.label).toBe('该动作已完成');
  });

  it('uses warmup policy reason when same movement pattern warmup is skipped', () => {
    const bench = patterned(makeExercise('bench', 1, 0, 1), 'horizontal_push');
    const incline = patterned(makeExercise('incline', 1, 0, 1), 'horizontal_push');
    let session = makeFocusSession([bench, incline]);

    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;

    session = switchFocusExercise(session, 1);
    const step = getCurrentFocusStep(session);
    expect(step.id).toBe('main:incline:working:0');
    expect(step.warmupPolicy?.policy).toBe('skipped_by_policy');
    expect(step.warmupPolicy?.reason).toContain('同模式热身');
  });
});
