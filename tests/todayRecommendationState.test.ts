import { describe, expect, it } from 'vitest';
import { pickSuggestedTemplate } from '../src/engines/sessionBuilder';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('today recommendation state', () => {
  it('does not let next template rotation override completed today state', () => {
    const completedPush = {
      ...makeFocusSession([makeExercise('bench', 1, 1)]),
      id: 'completed-push-a',
      date: '2026-04-27',
      templateId: 'push-a',
      templateName: 'Push A',
      startedAt: '2026-04-27T10:00:00-04:00',
      finishedAt: '2026-04-27T11:00:00-04:00',
      completed: true,
      dataFlag: 'normal' as const,
    };
    const data = makeAppData({ history: [completedPush], selectedTemplateId: 'legs-a' });
    const state = buildTodayTrainingState({
      activeSession: data.activeSession,
      history: data.history,
      currentLocalDate: '2026-04-27',
      plannedTemplateId: data.selectedTemplateId,
    });
    const nextTemplateId = pickSuggestedTemplate(data);

    expect(state.status).toBe('completed');
    expect(state.lastCompletedSessionId).toBe('completed-push-a');
    expect(nextTemplateId).toBeTruthy();
  });
});
