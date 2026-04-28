import { describe, expect, it } from 'vitest';
import { buildRecommendationDifferenceExplanation, getStableRecommendationSignature } from '../src/engines/recommendationDiffEngine';
import { buildRecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { makeAppData, makeSession } from './fixtures';

const unitSettings = (weightUnit: 'kg' | 'lb') => ({
  weightUnit,
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
});

const context = (overrides: Partial<ReturnType<typeof makeAppData>> = {}) => {
  const base = makeAppData();
  return makeAppData({
    ...overrides,
    userProfile: { ...base.userProfile, ...(overrides.userProfile || {}) },
    programTemplate: { ...base.programTemplate, ...(overrides.programTemplate || {}) },
  });
};

describe('recommendation consistency', () => {
  it('returns the same recommendation for the same context', () => {
    const data = context({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid' });

    expect(getStableRecommendationSignature(data)).toEqual(getStableRecommendationSignature(data));
  });

  it('keeps kg and lb logically identical while reporting the display-unit difference', () => {
    const kg = context({ selectedTemplateId: 'legs-a', unitSettings: unitSettings('kg') });
    const lb = context({ selectedTemplateId: 'legs-a', unitSettings: unitSettings('lb') });
    const report = buildRecommendationDifferenceExplanation(kg, lb);

    expect(getStableRecommendationSignature(kg)).toEqual(getStableRecommendationSignature(lb));
    expect(report.differences.map((item) => item.category)).toContain('unit');
  });

  it('explains differences caused by primary goal and training mode', () => {
    const hypertrophy = context({
      selectedTemplateId: 'push-a',
      trainingMode: 'hypertrophy',
      userProfile: { ...makeAppData().userProfile, primaryGoal: 'hypertrophy' },
    });
    const fatLossHybrid = context({
      selectedTemplateId: 'push-a',
      trainingMode: 'hybrid',
      userProfile: { ...makeAppData().userProfile, primaryGoal: 'fat_loss' },
    });
    const report = buildRecommendationDifferenceExplanation(hypertrophy, fatLossHybrid);

    expect(report.differences.map((item) => item.category)).toContain('primaryGoal');
    expect(report.differences.map((item) => item.category)).toContain('trainingMode');
    expect(report.possibleBugWarnings).toHaveLength(0);
  });

  it('does not let unrelated chest history directly change Legs A local prescription', () => {
    const baseline = context({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid' });
    const chestHistory = context({
      selectedTemplateId: 'legs-a',
      trainingMode: 'hybrid',
      history: [
        makeSession({
          id: 'yesterday-chest',
          date: '2026-04-27',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
        }),
      ],
    });

    expect(getStableRecommendationSignature(chestHistory)).toEqual(getStableRecommendationSignature(baseline));
    expect(buildRecommendationDifferenceExplanation(baseline, chestHistory).possibleBugWarnings).toHaveLength(0);
  });

  it('limits load feedback to the matching actual exercise', () => {
    const benchFeedbackHistory = [0, 1].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `bench-feedback-${index}`,
          date: `2026-04-2${index}`,
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 82.5, reps: 5, rir: 1 }],
        }),
        'bench-press',
        'too_heavy',
      ),
    );
    const legsBaseline = context({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid' });
    const legsWithBenchFeedback = context({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid', history: benchFeedbackHistory });

    expect(getStableRecommendationSignature(legsWithBenchFeedback)).toEqual(getStableRecommendationSignature(legsBaseline));
  });

  it('ignores test and excluded sessions in recommendation history', () => {
    const baseline = context({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid' });
    const excludedHistory = context({
      selectedTemplateId: 'legs-a',
      trainingMode: 'hybrid',
      history: [
        {
          ...makeSession({
            id: 'excluded-leg-session',
            date: '2026-04-27',
            templateId: 'legs-a',
            exerciseId: 'squat',
            setSpecs: [
              { weight: 120, reps: 5, rir: 0 },
              { weight: 120, reps: 5, rir: 0 },
            ],
          }),
          dataFlag: 'excluded' as const,
        },
      ],
    });

    expect(getStableRecommendationSignature(excludedHistory)).toEqual(getStableRecommendationSignature(baseline));
  });

  it('uses external health workouts only through global readiness context', () => {
    const trace = buildRecommendationTrace(
      context({
        selectedTemplateId: 'legs-a',
        importedWorkoutSamples: [
          {
            id: 'external-bike',
            source: 'apple_health_export',
            workoutType: 'cycling',
            startDate: '2026-04-27T18:00:00.000Z',
            endDate: '2026-04-27T19:10:00.000Z',
            durationMin: 70,
            activeEnergyKcal: 520,
            importedAt: '2026-04-27T20:00:00.000Z',
          },
        ],
      }),
    );

    expect(trace.globalFactors.some((factor) => factor.source === 'healthData')).toBe(true);
    expect(Object.values(trace.exerciseFactors).flat().some((factor) => factor.source === 'healthData')).toBe(false);
  });
});
