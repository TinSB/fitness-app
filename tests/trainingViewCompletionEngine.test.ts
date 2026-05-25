import { describe, expect, it } from 'vitest';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { completeTrainingViewSet } from '../src/engines/trainingViewCompletionEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('training view set completion', () => {
  it('completes the visible edited row without requiring a focus draft', () => {
    const session = makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);
    session.exercises[0].sets[0] = {
      ...session.exercises[0].sets[0],
      weight: 57.5,
      reps: 4,
      rpe: 8,
      rir: 1,
      techniqueQuality: 'good',
    };

    const result = completeTrainingViewSet(session, {
      exerciseIndex: 0,
      setIndex: 0,
      completedAt: '2026-05-25T10:00:00.000Z',
      nowMs: 1000,
      displayUnit: 'kg',
    });

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: true,
      reasonCode: 'completed',
      message: '已完成本组。',
    });
    expect(result.session.exercises[0].sets[0]).toMatchObject({
      done: true,
      weight: 57.5,
      actualWeightKg: 57.5,
      displayWeight: 57.5,
      displayUnit: 'kg',
      reps: 4,
      rpe: 8,
      rir: 1,
      techniqueQuality: 'good',
      completedAt: '2026-05-25T10:00:00.000Z',
    });
    expect(getCurrentFocusStep(result.session)).toMatchObject({
      exerciseIndex: 0,
      setIndex: 1,
    });
    expect(result.session.restTimerState).toMatchObject({
      exerciseId: 'bench-press',
      setIndex: 0,
      durationSec: 120,
    });
  });

  it('completes the clicked exercise row even when the focus cursor is elsewhere', () => {
    const session = makeFocusSession([
      { ...makeExercise('bench-press', 2), name: '平板卧推' },
      { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
    ]);
    session.exercises[1].sets[0] = {
      ...session.exercises[1].sets[0],
      weight: 32.5,
      reps: 9,
      rir: 2,
    };

    const result = completeTrainingViewSet(session, {
      exerciseIndex: 1,
      setIndex: 0,
      completedAt: '2026-05-25T10:05:00.000Z',
      nowMs: 2000,
      displayUnit: 'kg',
    });

    expect(result.actionResult.changed).toBe(true);
    expect(result.session.exercises[0].sets[0].done).toBe(false);
    expect(result.session.exercises[1].sets[0]).toMatchObject({
      done: true,
      actualWeightKg: 32.5,
      reps: 9,
      completedAt: '2026-05-25T10:05:00.000Z',
    });
  });

  it('returns missing_draft without mutating when the visible row has no weight or reps', () => {
    const session = makeFocusSession([{ ...makeExercise('bench-press', 1), name: '平板卧推' }]);
    session.exercises[0].sets[0] = {
      ...session.exercises[0].sets[0],
      weight: 0,
      reps: 0,
    };

    const result = completeTrainingViewSet(session, {
      exerciseIndex: 0,
      setIndex: 0,
      completedAt: '2026-05-25T10:10:00.000Z',
      nowMs: 3000,
    });

    expect(result.actionResult).toMatchObject({
      ok: false,
      changed: false,
      reasonCode: 'missing_draft',
      message: '请先填写重量和次数。',
    });
    expect(result.session).toEqual(session);
    expect(session.exercises[0].sets[0].done).toBe(false);
  });

  it('normalizes stale display fields to the current unit when completing the row', () => {
    const session = makeFocusSession([{ ...makeExercise('bench-press', 1), name: '平板卧推' }]);
    session.exercises[0].sets[0] = {
      ...session.exercises[0].sets[0],
      weight: 45.3592,
      displayWeight: 200,
      displayUnit: 'kg',
      reps: 5,
    };

    const result = completeTrainingViewSet(session, {
      exerciseIndex: 0,
      setIndex: 0,
      completedAt: '2026-05-25T10:15:00.000Z',
      nowMs: 4000,
      displayUnit: 'lb',
    });

    expect(result.actionResult.changed).toBe(true);
    expect(result.session.exercises[0].sets[0]).toMatchObject({
      actualWeightKg: 45.3592,
      displayWeight: 100,
      displayUnit: 'lb',
      reps: 5,
      done: true,
    });
  });
});
