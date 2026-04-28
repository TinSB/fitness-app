import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { applyStatusRules, buildRecommendationDifferenceExplanation, buildSetPrescription, makeSuggestion } from '../src/engines/progressionEngine';
import { getTemplate, makeStatus } from './fixtures';

describe('rep recommendation presentation', () => {
  it('does not force isolation exercises to the top of a wide rep range when history is missing', () => {
    const plan = applyStatusRules(getTemplate('push-a'), makeStatus(), 'hypertrophy', null, [], DEFAULT_SCREENING_PROFILE);
    const triceps = plan.exercises.find((exercise) => exercise.id === 'triceps-pushdown');
    if (!triceps) throw new Error('Missing triceps-pushdown');

    const suggestion = makeSuggestion(triceps, []);
    const prescription = buildSetPrescription(triceps, suggestion);

    expect(triceps.repMin).toBe(10);
    expect(triceps.repMax).toBe(20);
    expect(suggestion.reps).toBe(triceps.repMin);
    expect(prescription.topReps).toBe(triceps.repMin);
    expect(prescription.summary).toContain('10-20');
    expect(suggestion.note).toContain('目标范围');
    expect(suggestion.note).toContain('不代表每组必须做到 20 次');
  });

  it('explains why two users can receive different recommendations without splitting hypertrophy aliases', () => {
    expect(buildRecommendationDifferenceExplanation()).toContain('历史记录');
    expect(buildRecommendationDifferenceExplanation()).toContain('增肌');
    expect(buildRecommendationDifferenceExplanation()).toContain('肌肥大');
  });
});
