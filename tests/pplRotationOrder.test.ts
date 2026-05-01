import { describe, expect, it } from 'vitest';
import { getNextTemplateAfterLastCompletedSession } from '../src/engines/sessionBuilder';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import type { TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const completed = (templateId: string, exerciseId: string): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-done`,
    date: '2026-04-28',
    templateId,
    exerciseId,
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: '2026-04-28T10:00:00-04:00',
  completed: true,
});

describe('PPL rotation order', () => {
  it.each([
    ['push-a', 'bench-press', 'pull-a'],
    ['pull-a', 'lat-pulldown', 'legs-a'],
    ['legs-a', 'squat', 'push-a'],
  ])('rotates from %s to %s through the shared order helper', (templateId, exerciseId, expectedNext) => {
    const data = makeAppData({ history: [completed(templateId, exerciseId)] });

    expect(getNextTemplateAfterLastCompletedSession(data.history, data.templates, data.programTemplate)).toBe(expectedNext);

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });
    expect(recommendation.templateId).toBe(expectedNext);
  });
});
