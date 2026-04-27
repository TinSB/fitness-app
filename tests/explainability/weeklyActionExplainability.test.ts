import { describe, expect, it } from 'vitest';
import {
  buildWeeklyActionExplanation,
  buildWeeklyCoachReview,
  explainMuscleVolumeAction,
  formatExplanationItem,
} from '../../src/engines/explainability';
import type { WeeklyActionRecommendation } from '../../src/models/training-model';
import { expectCleanExplanation, expectCleanExplanationList } from './testUtils';

const volumeRecommendation: WeeklyActionRecommendation = {
  id: 'volume-back',
  priority: 'high',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: 'Back',
  issue: 'Back is below weekly target',
  recommendation: 'Add two back sets next week',
  reason: 'Weighted effective sets are below target',
  suggestedChange: { muscleId: 'back', setsDelta: 2, exerciseIds: ['lat-pulldown'] },
  evidenceRuleIds: ['weekly_volume_distribution'],
  confidence: 'high',
};

describe('weekly action explainability module', () => {
  it('explains why a low muscle target needs added volume', () => {
    const item = buildWeeklyActionExplanation(volumeRecommendation);
    const text = formatExplanationItem(item);

    expect(text).toContain('Add two back sets');
    expect(explainMuscleVolumeAction(volumeRecommendation)).toContain('建议补量');
    expectCleanExplanation(text);
  });

  it('explains why deload week does not force catch-up volume', () => {
    const item = buildWeeklyActionExplanation({
      ...volumeRecommendation,
      id: 'deload-back',
      category: 'mesocycle',
      recommendation: 'Deload week: do not force catch-up volume',
      reason: 'Fatigue reduction is the priority this week',
      suggestedChange: { muscleId: 'back', setsDelta: 0, volumeMultiplier: 0.6 },
      evidenceRuleIds: ['deload_volume_reduction', 'weekly_volume_distribution'],
      confidence: 'medium',
    });

    const text = formatExplanationItem(item);
    expect(text).toContain('Deload week');
    expect(text).toContain('Fatigue reduction');
    expectCleanExplanation(text);
  });

  it('summarizes weekly coaching actions without unsafe text', () => {
    const lines = buildWeeklyCoachReview({
      history: [],
      weeklyPrescription: {
        weekStart: '2026-04-20',
        muscles: [{ muscle: 'back', target: 12, sets: 5, remaining: 7, frequency: 1 }],
      },
      adherenceReport: {
        recentSessionCount: 0,
        plannedSets: 0,
        actualSets: 0,
        overallRate: 100,
        mainlineRate: 100,
        recentSessions: [],
        skippedExercises: [],
        skippedSupportExercises: [],
        suggestions: [],
        confidence: 'low',
      },
      adherenceAdjustment: {
        complexityLevel: 'normal',
        correctionDoseAdjustment: 'keep',
        functionalDoseAdjustment: 'keep',
        weeklyVolumeMultiplier: 1,
        reasons: [],
      },
      weeklyActions: [volumeRecommendation],
    });

    expect(lines.join(' ')).toContain('back');
    expectCleanExplanationList(lines);
  });
});
