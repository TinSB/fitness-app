import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import type { PainPattern, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const completedPush = (): TrainingSession => ({
  ...makeSession({
    id: 'completed-push-a',
    date: '2026-04-28',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: '2026-04-28T10:00:00-04:00',
  completed: true,
});

describe('recovery override order', () => {
  it('keeps Pull A as planned next template and explains a recovery override to Legs A', () => {
    const data = makeAppData({ history: [completedPush()] });
    const backPain: PainPattern = {
      area: 'back',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      painPatterns: [backPain],
    });

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.overrideReason).toBeTruthy();
    expect(recommendation.reason).toContain('原计划');
    expect(recommendation.warnings.join('\n')).toContain('原计划');
  });

  it('does not skip Pull A when there is no recovery conflict', () => {
    const data = makeAppData({ history: [completedPush()] });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.overrideReason).toBeUndefined();
  });
});
