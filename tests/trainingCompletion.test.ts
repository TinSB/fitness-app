import { describe, expect, it } from 'vitest';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { completeTrainingSessionIntoHistory, finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { emptyData } from '../src/storage/persistence';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('training completion persistence', () => {
  it('finalizes a session with required history fields', () => {
    const session = {
      ...makeFocusSession([makeExercise('bench', 1, 1)]),
      startedAt: '2026-04-27T20:00:00-04:00',
      programTemplateId: 'push-a',
      isExperimentalTemplate: false,
    };
    const finished = finalizeTrainingSession(session, '2026-04-27T21:00:00-04:00');
    expect(finished.completed).toBe(true);
    expect(finished.dataFlag).toBe('normal');
    expect(finished.date).toBe('2026-04-27');
    expect(finished.durationMin).toBe(60);
    expect(finished.programTemplateId).toBe('push-a');
  });

  it('moves activeSession into history and clears activeSession', () => {
    const activeSession = {
      ...makeFocusSession([makeExercise('bench', 1, 1)]),
      startedAt: '2026-04-27T20:00:00-04:00',
    };
    const result = completeTrainingSessionIntoHistory({ ...emptyData(), activeSession }, '2026-04-27T21:00:00-04:00');
    expect(result.data.activeSession).toBeNull();
    expect(result.data.history).toHaveLength(1);
    expect(result.data.history[0].dataFlag).toBe('normal');
  });

  it('saved session can be read by the calendar engine', () => {
    const activeSession = {
      ...makeFocusSession([makeExercise('bench', 1, 1)]),
      startedAt: '2026-04-27T20:00:00-04:00',
    };
    const result = completeTrainingSessionIntoHistory({ ...emptyData(), activeSession }, '2026-04-27T21:00:00-04:00');
    const calendar = buildTrainingCalendar(result.data.history, '2026-04');
    const day = calendar.days.find((item) => item.date === '2026-04-27');
    expect(day?.totalSessions).toBe(1);
  });

  it('moves Today state to completed after session finalization', () => {
    const activeSession = {
      ...makeFocusSession([makeExercise('bench', 1, 1)]),
      id: 'push-a-completed',
      templateId: 'push-a',
      templateName: 'Push A',
      startedAt: '2026-04-27T20:00:00-04:00',
    };
    const result = completeTrainingSessionIntoHistory({ ...emptyData(), activeSession }, '2026-04-27T21:00:00-04:00');
    const state = buildTodayTrainingState({
      activeSession: result.data.activeSession,
      history: result.data.history,
      currentLocalDate: '2026-04-27',
    });

    expect(result.data.activeSession).toBeNull();
    expect(state.status).toBe('completed');
    expect(state.lastCompletedSessionId).toBe('push-a-completed');
  });
});
