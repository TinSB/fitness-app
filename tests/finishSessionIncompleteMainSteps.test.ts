import { describe, expect, it } from 'vitest';
import {
  buildIncompleteMainWorkGuard,
  completeTrainingSessionIntoHistory,
  finalizeTrainingSession,
} from '../src/engines/trainingCompletionEngine';
import { completedSets, isIncompleteSet, sessionCompletedSets } from '../src/engines/engineUtils';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('finish session incomplete main work guard', () => {
  it('detects unfinished main exercises before finalizing a session', () => {
    const session = makeFocusSession([
      makeExercise('assisted-pull-up', 2, 2),
      makeExercise('face-pull', 2, 0),
      makeExercise('db-curl', 2, 0),
    ]);

    const guard = buildIncompleteMainWorkGuard(session);

    expect(guard.hasIncompleteMainWork).toBe(true);
    expect(guard.allMainWorkNotStarted).toBe(false);
    expect(guard.incompleteSetCount).toBe(4);
    expect(guard.incompleteExercises.map((item) => item.exerciseId)).toEqual(['face-pull', 'db-curl']);
  });

  it('marks an early-ended session without converting incomplete draft sets into completed sets', () => {
    const session = makeFocusSession([
      makeExercise('assisted-pull-up', 2, 2),
      makeExercise('face-pull', 2, 0),
    ]);

    const finished = finalizeTrainingSession(session, '2026-04-30T11:00:00-04:00', { endedEarly: true });
    const unfinishedExercise = finished.exercises.find((exercise) => exercise.id === 'face-pull');

    expect(finished.completed).toBe(true);
    expect(finished.earlyEndReason).toBe('incomplete_main_work');
    expect(finished.earlyEndSummary).toContain('部分动作未完成');
    expect(unfinishedExercise?.completionStatus).toBe('not_started');
    expect(unfinishedExercise?.incompleteReason).toBe('ended_early');
    expect(completedSets(unfinishedExercise || { sets: [] })).toEqual([]);
    expect((unfinishedExercise?.sets || []).every((set) => isIncompleteSet(set))).toBe(true);
    expect((unfinishedExercise?.sets || []).every((set) => set.incompleteReason === 'ended_early')).toBe(true);
    expect(sessionCompletedSets(finished)).toBe(2);
  });

  it('writes an early-ended completed session to history while preserving unfinished planned sets', () => {
    const session = makeFocusSession([
      makeExercise('assisted-pull-up', 2, 2),
      makeExercise('face-pull', 2, 0),
    ]);
    const result = completeTrainingSessionIntoHistory(
      { ...makeAppData(), activeSession: session },
      '2026-04-30T11:00:00-04:00',
      { endedEarly: true },
    );

    expect(result.data.activeSession).toBeNull();
    expect(result.session?.completed).toBe(true);
    expect(result.session?.earlyEndSummary).toContain('未完成动作不会计入有效组');
    expect(result.data.history[0].id).toBe(session.id);
    expect(result.data.history[0].exercises.find((exercise) => exercise.id === 'face-pull')?.completionStatus).toBe('not_started');
  });

  it('uses a dedicated summary when all main work is unfinished', () => {
    const session = makeFocusSession([makeExercise('lat-pulldown', 2, 0), makeExercise('face-pull', 2, 0)]);
    const guard = buildIncompleteMainWorkGuard(session);
    const finished = finalizeTrainingSession(session, '2026-04-30T11:00:00-04:00', { endedEarly: true });

    expect(guard.allMainWorkNotStarted).toBe(true);
    expect(guard.summary).toContain('训练提前结束，主训练未完成');
    expect(finished.earlyEndSummary).toContain('训练提前结束，主训练未完成');
  });
});
