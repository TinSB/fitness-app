import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('recommendation explanation UI', () => {
  const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');
  const planSource = readFileSync('src/features/PlanView.tsx', 'utf8');
  const trainingSource = readFileSync('src/features/TrainingView.tsx', 'utf8');

  it('keeps the explanation entry lightweight and collapsed', () => {
    expect(todaySource).toContain('为什么这样推荐？');
    expect(planSource).toContain('为什么这样推荐？');
    expect(trainingSource).toContain('为什么这样推荐？');
    expect(todaySource).toContain('<details');
    expect(planSource).toContain('<details');
    expect(trainingSource).toContain('<details');
  });

  it('uses trace reasons for Today and Plan without exposing raw technical fields', () => {
    expect(todaySource).toContain('buildRecommendationTrace');
    expect(todaySource).toContain('getRecommendationTraceReasons');
    expect(planSource).toContain('buildRecommendationTrace');
    expect(planSource).toContain('getRecommendationTraceReasons');
  });

  it('shows existing session explanations in the full training preview', () => {
    expect(trainingSource).toContain('session.explanations');
    expect(trainingSource).toContain('当前主要使用起始模板和默认处方，历史数据仍在积累中。');
  });
});
