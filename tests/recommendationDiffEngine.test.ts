// recommendationDiffEngine — signal-only after Training Recommendation Hard
// Rewrite V2. This test asserts only the stable per-exercise signature
// contract; the legacy text-emitting difference explanation is gone.

import { describe, expect, it } from 'vitest';
import { getStableRecommendationSignature } from '../src/engines/recommendationDiffEngine';
import { upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { makeAppData, makeSession } from './fixtures';

const withGoalMode = (
  templateId: string,
  primaryGoal: 'hypertrophy' | 'fat_loss' | 'strength' | 'health',
  trainingMode: 'hypertrophy' | 'strength' | 'hybrid',
  overrides: Partial<ReturnType<typeof makeAppData>> = {},
) => {
  const base = makeAppData();
  return makeAppData({
    ...overrides,
    selectedTemplateId: templateId,
    trainingMode,
    userProfile: { ...base.userProfile, primaryGoal, ...(overrides.userProfile || {}) },
    programTemplate: { ...base.programTemplate, primaryGoal, ...(overrides.programTemplate || {}) },
  });
};

describe('recommendationDiffEngine signal-only contract', () => {
  it('produces a deterministic signature for identical inputs', () => {
    const context = withGoalMode('legs-a', 'hypertrophy', 'hybrid');
    expect(getStableRecommendationSignature(context)).toEqual(getStableRecommendationSignature(context));
  });

  it('limits load feedback influence to matching exercise pools (signature only)', () => {
    const recentDate = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };
    const heavyBenchHistory = [0, 1].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `bench-heavy-${index}`,
          date: recentDate(index + 1),
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 85, reps: 5, rir: 1 }],
        }),
        'bench-press',
        'too_heavy',
      ),
    );

    const legsBaseline = withGoalMode('legs-a', 'hypertrophy', 'hybrid');
    const legsWithBenchFeedback = withGoalMode('legs-a', 'hypertrophy', 'hybrid', { history: heavyBenchHistory });
    const pushWithBenchFeedback = withGoalMode('push-a', 'hypertrophy', 'hybrid', { history: heavyBenchHistory });

    // Bench feedback should not change a legs-only signature
    expect(getStableRecommendationSignature(legsWithBenchFeedback)).toEqual(getStableRecommendationSignature(legsBaseline));
    // But it should mark bench-press conservative on a push template
    expect(getStableRecommendationSignature(pushWithBenchFeedback).find((item) => item.id === 'bench-press')?.conservative).toBe(true);
  });
});
