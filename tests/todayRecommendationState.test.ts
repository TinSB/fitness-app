import { describe, expect, it } from 'vitest';
import { pickSuggestedTemplate, scoreSuggestedTemplates } from '../src/engines/sessionBuilder';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import type { HealthSummary } from '../src/engines/healthSummaryEngine';
import type { TrainingTemplate } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const template = (id: string, exerciseId: string, kind: string, fatigueCost: 'low' | 'medium' | 'high'): TrainingTemplate => ({
  id,
  name: id,
  focus: '胸部',
  duration: 60,
  note: '',
  exercises: [
    {
      id: exerciseId,
      name: exerciseId,
      muscle: '胸',
      kind,
      sets: 3,
      repMin: 8,
      repMax: 12,
      rest: 120,
      startWeight: 40,
      movementPattern: 'horizontal_push',
      primaryMuscles: ['chest'],
      fatigueCost,
    } as never,
  ],
});

const recoveryHealthSummary: HealthSummary = {
  latestSleepHours: 5.5,
  recentWorkoutCount: 0,
  recentWorkoutMinutes: 0,
  recentHighActivityDays: 0,
  notes: ['导入健康数据仅作训练准备度辅助。'],
  confidence: 'medium',
};

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

  it('uses the same health readiness context when scoring suggested templates', () => {
    const highFatigueTemplate = template('heavy-push', 'bench-press', 'compound', 'high');
    const lowFatigueTemplate = template('easy-push', 'cable-fly', 'isolation', 'low');
    const data = makeAppData({
      templates: [highFatigueTemplate, lowFatigueTemplate],
      selectedTemplateId: 'heavy-push',
      settings: {
        healthIntegrationSettings: {
          useHealthDataForReadiness: true,
          showExternalWorkoutsInCalendar: true,
        },
      },
    });

    const healthScores = scoreSuggestedTemplates(data, {
      healthSummary: recoveryHealthSummary,
      useHealthDataForReadiness: true,
    });
    const disabledScores = scoreSuggestedTemplates(data, {
      healthSummary: recoveryHealthSummary,
      useHealthDataForReadiness: false,
    });
    const highHealthScore = healthScores.find((item) => item.id === 'heavy-push')?.score ?? 0;
    const highDisabledScore = disabledScores.find((item) => item.id === 'heavy-push')?.score ?? 0;

    expect(
      pickSuggestedTemplate(data, {
        healthSummary: recoveryHealthSummary,
        useHealthDataForReadiness: false,
      })
    ).toBe(pickSuggestedTemplate(data));
    expect(highHealthScore).toBeLessThan(highDisabledScore);
  });
});
