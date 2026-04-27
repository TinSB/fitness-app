import { describe, expect, it } from 'vitest';
import {
  adjustFocusSetValue,
  completeFocusSet,
  dedupeFocusNotices,
  getFocusNavigationState,
  switchFocusExercise,
} from '../src/engines/focusModeStateEngine';
import type { ExercisePrescription, TrainingSession, TrainingSetLog } from '../src/models/training-model';

const makeSets = (exerciseId: string, count: number, doneCount = 0): TrainingSetLog[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${exerciseId}-${index + 1}`,
    weight: 50,
    reps: 8,
    rpe: '',
    rir: 2,
    done: index < doneCount,
    painFlag: false,
  }));

const makeExercise = (id: string, setCount: number, doneCount = 0): ExercisePrescription =>
  ({
    id,
    baseId: id,
    name: id,
    muscle: '胸',
    kind: 'compound',
    repMin: 6,
    repMax: 8,
    rest: 120,
    startWeight: 50,
    sets: makeSets(id, setCount, doneCount),
  }) as ExercisePrescription;

const makeSession = (exercises: ExercisePrescription[]): TrainingSession => ({
  id: 'session-focus',
  date: '2026-04-27',
  templateId: 'push-a',
  templateName: 'Push A',
  trainingMode: 'hybrid',
  exercises,
  completed: false,
  currentExerciseId: exercises[0]?.id,
  currentSetIndex: 0,
  focusSessionComplete: false,
});

describe('focusModeStateEngine', () => {
  it('完成一组后进入同动作下一组', () => {
    const session = makeSession([makeExercise('bench', 3), makeExercise('row', 2)]);
    const result = completeFocusSet(session, 0, '2026-04-27T10:00:00.000Z', 1000);

    expect(result?.nextExerciseIndex).toBe(0);
    expect(result?.nextSetIndex).toBe(1);
    expect(result?.session.exercises[0].sets[0].done).toBe(true);
    expect(result?.session.currentExerciseId).toBe('bench');
    expect(result?.session.currentSetIndex).toBe(1);
    expect(result?.session.restTimerState?.isRunning).toBe(true);
  });

  it('当前动作完成后进入下一个未完成动作', () => {
    const session = makeSession([makeExercise('bench', 1), makeExercise('row', 2)]);
    const result = completeFocusSet(session, 0, '2026-04-27T10:00:00.000Z', 1000);

    expect(result?.nextExerciseIndex).toBe(1);
    expect(result?.nextSetIndex).toBe(0);
    expect(result?.session.currentExerciseId).toBe('row');
    expect(result?.session.currentSetIndex).toBe(0);
    expect(result?.sessionComplete).toBe(false);
  });

  it('所有动作完成后进入完成状态且不会回到第一个动作', () => {
    const session = {
      ...makeSession([makeExercise('bench', 1, 1), makeExercise('row', 1)]),
      currentExerciseId: 'row',
      currentSetIndex: 0,
    };
    const result = completeFocusSet(session, 1, '2026-04-27T10:00:00.000Z', 1000);
    const state = getFocusNavigationState(result?.session);

    expect(result?.sessionComplete).toBe(true);
    expect(result?.nextExerciseIndex).toBe(-1);
    expect(result?.session.focusSessionComplete).toBe(true);
    expect(state.sessionComplete).toBe(true);
    expect(state.currentExerciseIndex).toBe(1);
    expect(state.currentSetIndex).toBe(-1);
  });

  it('切换动作后进入该动作第一个未完成组', () => {
    const session = makeSession([makeExercise('bench', 3), makeExercise('row', 3, 1)]);
    const switched = switchFocusExercise(session, 1);
    const state = getFocusNavigationState(switched);

    expect(switched.currentExerciseId).toBe('row');
    expect(switched.currentSetIndex).toBe(1);
    expect(state.currentExerciseIndex).toBe(1);
    expect(state.currentSetIndex).toBe(1);
  });

  it('快捷调整 reps 和 weight 生效且不低于下限', () => {
    const session = makeSession([makeExercise('bench', 1)]);
    const plusRep = adjustFocusSetValue(session, 0, 'reps', 1);
    const minusRep = adjustFocusSetValue(plusRep, 0, 'reps', -20);
    const plusWeight = adjustFocusSetValue(session, 0, 'weight', 2.5);
    const minusWeight = adjustFocusSetValue(plusWeight, 0, 'weight', -100);

    expect((plusRep.exercises[0].sets as TrainingSetLog[])[0].reps).toBe(9);
    expect((minusRep.exercises[0].sets as TrainingSetLog[])[0].reps).toBe(0);
    expect((plusWeight.exercises[0].sets as TrainingSetLog[])[0].weight).toBe(52.5);
    expect((minusWeight.exercises[0].sets as TrainingSetLog[])[0].weight).toBe(0);
  });

  it('重复提示会去重且数量受限', () => {
    const notices = dedupeFocusNotices(
      [
        { id: 'a', type: 'warning', tone: 'warning', message: '已切到替代动作' },
        { id: 'b', type: 'warning', tone: 'warning', message: '已切到替代动作' },
        { id: 'c', type: 'pain', tone: 'warning', message: '有不适' },
        { id: 'd', type: 'load', tone: 'info', message: '重量偏重' },
      ],
      2
    );

    expect(notices).toHaveLength(2);
    expect(notices.map((notice) => notice.message)).toEqual(['已切到替代动作', '有不适']);
  });
});
