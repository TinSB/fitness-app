import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, buildFocusStepQueue, completeFocusSet, getCurrentFocusStep, isFocusSessionComplete } from '../src/engines/focusModeStateEngine';
import type { TrainingSession } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

describe('focus step queue', () => {
  it('orders 3 warmup steps before 2 working steps for one exercise', () => {
    const session = makeFocusSession([makeExercise('bench', 2, 0, 3)]);
    expect(buildFocusStepQueue(session).map((step) => `${step.stepType}:${step.setIndex}`)).toEqual([
      'warmup:0',
      'warmup:1',
      'warmup:2',
      'working:0',
      'working:1',
    ]);
  });

  it('places correction before main and functional after main', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1, 0, 1)]));
    expect(buildFocusStepQueue(session).map((step) => step.blockType)).toEqual([
      'correction',
      'correction',
      'main',
      'main',
      'functional',
      'functional',
    ]);
  });

  it('skips empty correction and functional blocks', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1, 0, 1)]), [], []);
    expect(buildFocusStepQueue(session).map((step) => step.blockType)).toEqual(['main', 'main']);
  });

  it('advances warmup1 to warmup2, then warmup3, then working1', () => {
    let session = makeFocusSession([makeExercise('bench', 2, 0, 3)]);

    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).id).toBe('main:bench:warmup:1');

    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).id).toBe('main:bench:warmup:2');

    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).id).toBe('main:bench:working:0');
  });

  it('advances from last working set to next exercise', () => {
    let session = makeFocusSession([makeExercise('bench', 1), makeExercise('row', 1)]);
    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).exerciseId).toBe('row');
    expect(getCurrentFocusStep(session).stepType).toBe('working');
    expect(getCurrentFocusStep(session).setIndex).toBe(0);
  });

  it('marks session complete without wrapping to first exercise', () => {
    let session = makeFocusSession([makeExercise('bench', 1), makeExercise('row', 1)]);
    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    session = applySuggestedFocusStep(session, 1);
    session = completeFocusSet(session, 1)?.session as TrainingSession;

    expect(isFocusSessionComplete(session)).toBe(true);
    expect(getCurrentFocusStep(session).stepType).toBe('completed');
    expect(session.currentExerciseId).toBe('');
  });

  it('does not force warmup steps for small isolation exercises', () => {
    const session = makeFocusSession([
      makeExercise('bench', 2, 0, 2),
      {
        ...makeExercise('triceps_pushdown', 2, 0, 2),
        name: '三头下压',
        kind: 'isolation',
        orderPriority: 6,
        startWeight: 25,
      },
    ]);
    const tricepsSteps = buildFocusStepQueue(session).filter((step) => step.exerciseId === 'triceps_pushdown');
    expect(tricepsSteps.map((step) => step.stepType)).toEqual(['working', 'working']);
    expect(tricepsSteps[0].warmupPolicy?.reason).toContain('孤立动作');
  });
});
