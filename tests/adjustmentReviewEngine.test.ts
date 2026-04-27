import { describe, expect, it } from 'vitest';
import { reviewAdjustmentEffect } from '../src/engines/adjustmentReviewEngine';
import type { ProgramAdjustmentHistoryItem } from '../src/models/training-model';
import { getTemplate, makeSession } from './fixtures';

const chestMuscleId = getTemplate('push-a').exercises[0]?.primaryMuscles?.[0] || getTemplate('push-a').exercises[0]?.muscle || '胸';

const historyItem: ProgramAdjustmentHistoryItem = {
  id: 'history-1',
  appliedAt: '2026-04-20T00:00:00.000Z',
  sourceProgramTemplateId: 'push-a',
  experimentalProgramTemplateId: 'push-a-experiment',
  sourceProgramTemplateName: 'Push A',
  experimentalProgramTemplateName: 'Push A Experiment',
  selectedRecommendationIds: ['rec-1'],
  changes: [
    {
      id: 'change-1',
      type: 'add_sets',
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      muscleId: chestMuscleId,
      setsDelta: 1,
      reason: 'Increase chest volume',
    },
  ],
  rollbackAvailable: true,
};

describe('adjustmentReviewEngine', () => {
  it('uses appliedAt to split before and after history', () => {
    const history = [
      makeSession({
        id: 'before-1',
        date: '2026-04-10',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'after-1',
        date: '2026-04-22',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }],
      }),
      makeSession({
        id: 'after-2',
        date: '2026-04-24',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }],
      }),
    ];

    const review = reviewAdjustmentEffect(historyItem, history, { minBeforeSessions: 1, minAfterSessions: 2 });
    expect(review.metrics.beforeSessionCount).toBe(1);
    expect(review.metrics.afterSessionCount).toBe(2);
  });

  it('uses programTemplateId to distinguish source and experimental sessions', () => {
    const history = [
      makeSession({
        id: 'before-1',
        date: '2026-04-10',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'before-2',
        date: '2026-04-12',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'other-template',
        date: '2026-04-23',
        templateId: 'pull-a',
        programTemplateId: 'pull-a',
        exerciseId: 'seated-row',
        setSpecs: [{ weight: 55, reps: 10, rir: 2 }],
      }),
      makeSession({
        id: 'after-1',
        date: '2026-04-24',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }],
      }),
      makeSession({
        id: 'after-2',
        date: '2026-04-26',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }],
      }),
    ];

    const review = reviewAdjustmentEffect(historyItem, history);
    expect(review.metrics.beforeSessionCount).toBe(2);
    expect(review.metrics.afterSessionCount).toBe(2);
  });

  it('returns too_early when after data is still insufficient', () => {
    const history = [
      makeSession({
        id: 'before-1',
        date: '2026-04-10',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'after-1',
        date: '2026-04-22',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }],
      }),
    ];

    const review = reviewAdjustmentEffect(historyItem, history);
    expect(review.status).toBe('too_early');
    expect(review.recommendation).toBe('collect_more_data');
  });

  it('returns improved when target muscle improves and adherence stays stable', () => {
    const history = [
      makeSession({
        id: 'before-1',
        date: '2026-04-10',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'before-2',
        date: '2026-04-12',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, rir: 2 }],
      }),
      makeSession({
        id: 'after-1',
        date: '2026-04-22',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 62.5, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 57.5, reps: 8, rir: 2, techniqueQuality: 'good' },
        ],
      }),
      makeSession({
        id: 'after-2',
        date: '2026-04-24',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 62.5, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 57.5, reps: 8, rir: 2, techniqueQuality: 'good' },
        ],
      }),
    ];

    const review = reviewAdjustmentEffect(historyItem, history, { targetMuscleIds: [chestMuscleId] });
    expect(review.status).toBe('improved');
    expect(review.recommendation).toBe('keep');
    expect(review.metrics.targetMuscleChange).toBeGreaterThan(0);
  });

  it('returns worse and asks for review when pain signals rise', () => {
    const history = [
      makeSession({
        id: 'before-1',
        date: '2026-04-10',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 8, rir: 2 }],
      }),
      makeSession({
        id: 'before-2',
        date: '2026-04-12',
        templateId: 'push-a',
        programTemplateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 8, rir: 2 }],
      }),
      makeSession({
        id: 'after-1',
        date: '2026-04-22',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2, painFlag: true, painArea: 'shoulder', painSeverity: 4 }],
      }),
      makeSession({
        id: 'after-2',
        date: '2026-04-24',
        templateId: 'push-a',
        programTemplateId: 'push-a-experiment',
        programTemplateName: 'Push A Experiment',
        isExperimentalTemplate: true,
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 62.5, reps: 8, rir: 2, painFlag: true, painArea: 'shoulder', painSeverity: 4 }],
      }),
    ];

    const review = reviewAdjustmentEffect(historyItem, history);
    expect(review.status).toBe('worse');
    expect(['review_manually', 'rollback']).toContain(review.recommendation);
  });
});
