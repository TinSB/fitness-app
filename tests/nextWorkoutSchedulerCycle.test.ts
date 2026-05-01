import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import type { PainPattern, SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string, dataFlag: SessionDataFlag = 'normal'): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  completed: true,
  dataFlag,
  finishedAt: `${date}T10:00:00-04:00`,
});

const recommend = (history: TrainingSession[], options: Partial<Parameters<typeof buildNextWorkoutRecommendation>[0]> = {}) => {
  const data = makeAppData({ history });
  return buildNextWorkoutRecommendation({
    history: data.history,
    templates: data.templates,
    programTemplate: data.programTemplate,
    ...options,
  });
};

describe('next workout scheduler cycle integration', () => {
  it.each([
    [['push-a'], 'pull-a'],
    [['pull-a'], 'legs-a'],
    [['legs-a'], 'push-a'],
  ])('keeps normal PPL order after %s', (completedTemplates, expectedNext) => {
    const history = completedTemplates.map((templateId, index) => completedSession(templateId, `2026-04-${27 + index}`));

    const recommendation = recommend(history);

    expect(recommendation.plannedTemplateId).toBe(expectedNext);
    expect(recommendation.templateId).toBe(expectedNext);
    expect(recommendation.overrideReason).toBeUndefined();
  });

  it('starts a new cycle after out-of-order Push A, Legs A, and Pull A', () => {
    const recommendation = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ]);

    expect(recommendation.plannedTemplateId).toBe('push-a');
    expect(recommendation.templateId).toBe('push-a');
    expect(recommendation.reason).toContain('新一轮');
  });

  it('fills the missing Pull A after out-of-order Push A and Legs A', () => {
    const recommendation = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
    ]);

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('pull-a');
  });

  it('keeps test and excluded sessions out of the cycle state', () => {
    const recommendation = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('pull-a', '2026-04-28', 'test'),
      completedSession('legs-a', '2026-04-29', 'excluded'),
    ]);

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('pull-a');
  });

  it('keeps completed Today next suggestion on scheduler cycle output', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const data = makeAppData({ history, selectedTemplateId: 'legs-a' });
    const todayState = buildTodayTrainingState({
      history,
      activeSession: null,
      currentLocalDate: '2026-04-30',
      plannedTemplateId: data.selectedTemplateId,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    const recommendation = buildNextWorkoutRecommendation({
      history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      todayState,
    });

    expect(todayState.status).toBe('completed');
    expect(recommendation.plannedTemplateId).toBe('push-a');
    expect(recommendation.templateId).toBe('push-a');
  });

  it('allows recovery override from planned Pull A and preserves the explanation', () => {
    const backPain: PainPattern = {
      area: 'back',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };

    const recommendation = recommend([completedSession('push-a', '2026-04-27')], {
      painPatterns: [backPain],
    });

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).not.toBe('pull-a');
    expect(recommendation.overrideReason).toBeTruthy();
    expect(recommendation.reason).toContain('原计划');
  });

  it('does not jump from Push A to Legs A when there is no recovery conflict', () => {
    const recommendation = recommend([completedSession('push-a', '2026-04-27')]);

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.overrideReason).toBeUndefined();
  });
});
