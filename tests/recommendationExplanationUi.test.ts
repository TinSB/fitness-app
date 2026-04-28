import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('recommendation explanation UI wiring', () => {
  const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');
  const planSource = readFileSync('src/features/PlanView.tsx', 'utf8');
  const trainingSource = readFileSync('src/features/TrainingView.tsx', 'utf8');
  const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('uses the shared explanation panel across recommendation surfaces', () => {
    expect(todaySource).toContain('RecommendationExplanationPanel');
    expect(planSource).toContain('RecommendationExplanationPanel');
    expect(trainingSource).toContain('RecommendationExplanationPanel');
    expect(focusSource).toContain('RecommendationExplanationPanel');
  });

  it('keeps Today and Plan on trace view models without page-specific reason lists', () => {
    expect(todaySource).toContain('buildRecommendationTrace');
    expect(planSource).toContain('buildRecommendationTrace');
    expect(todaySource).not.toContain('getRecommendationTraceReasons');
    expect(planSource).not.toContain('getRecommendationTraceReasons');
  });

  it('keeps training surfaces on session explanation traces', () => {
    expect(trainingSource).toContain('buildSessionRecommendationTrace');
    expect(focusSource).toContain('buildSessionRecommendationTrace');
  });
});
