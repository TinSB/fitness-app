import { describe, expect, it } from 'vitest';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const session = (overrides: Partial<ReturnType<typeof makeFocusSession>> = {}) => ({
  ...makeFocusSession([makeExercise('bench', 2, 2)]),
  id: 'session-1',
  date: '2026-04-27',
  startedAt: '2026-04-27T20:00:00-04:00',
  finishedAt: '2026-04-27T21:00:00-04:00',
  completed: true,
  dataFlag: 'normal' as const,
  ...overrides,
});

describe('todayStateEngine', () => {
  it('returns not_started when there is no active session or completed history today', () => {
    const state = buildTodayTrainingState({
      history: [],
      currentLocalDate: '2026-04-27',
      plannedTemplateId: 'push-a',
    });

    expect(state.status).toBe('not_started');
    expect(state.primaryAction).toBe('start_training');
    expect(state.plannedTemplateId).toBe('push-a');
  });

  it('gives activeSession priority over completed history', () => {
    const activeSession = session({ id: 'active-session', completed: false });
    const state = buildTodayTrainingState({
      activeSession,
      history: [session({ id: 'completed-session' })],
      currentLocalDate: '2026-04-27',
    });

    expect(state.status).toBe('in_progress');
    expect(state.primaryAction).toBe('continue_training');
    expect(state.activeSessionId).toBe('active-session');
  });

  it('returns completed when today has a normal completed session', () => {
    const state = buildTodayTrainingState({
      history: [session({ id: 'push-a-done' })],
      currentLocalDate: '2026-04-27',
    });

    expect(state.status).toBe('completed');
    expect(state.primaryAction).toBe('view_summary');
    expect(state.completedSessionIds).toEqual(['push-a-done']);
    expect(state.lastCompletedSessionId).toBe('push-a-done');
  });

  it('ignores test and excluded sessions for today completion', () => {
    const state = buildTodayTrainingState({
      history: [
        session({ id: 'test-session', dataFlag: 'test' }),
        session({ id: 'excluded-session', dataFlag: 'excluded' }),
      ],
      currentLocalDate: '2026-04-27',
    });

    expect(state.status).toBe('not_started');
  });

  it('uses local date keys for timestamp comparisons', () => {
    const state = buildTodayTrainingState({
      history: [
        session({
          id: 'late-local-session',
          date: '2026-04-27T23:30:00-04:00',
          startedAt: '2026-04-27T23:30:00-04:00',
          finishedAt: '2026-04-28T00:20:00-04:00',
        }),
      ],
      currentLocalDate: '2026-04-27',
    });

    expect(state.status).toBe('completed');
    expect(state.lastCompletedSessionId).toBe('late-local-session');
  });
});
