import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRecommendationDifferenceExplanation, getStableRecommendationSignature } from '../src/engines/recommendationDiffEngine';
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

const loadUserComparisonFixture = (name: string) => {
  const raw = JSON.parse(readFileSync(`tests/fixtures/userComparison/${name}.json`, 'utf8')) as {
    selectedTemplateId: string;
    trainingMode: 'hypertrophy' | 'strength' | 'hybrid';
    userProfile: { primaryGoal: 'hypertrophy' | 'fat_loss' | 'strength' | 'health'; trainingLevel?: string };
    todayStatus: Record<string, unknown>;
    history: Array<{
      id: string;
      date: string;
      templateId: string;
      exerciseId: string;
      sets: Array<{ weight: number; reps: number; rir?: number; techniqueQuality?: 'good' | 'acceptable' | 'poor' }>;
      loadFeedback?: 'too_light' | 'good' | 'too_heavy';
    }>;
  };
  const base = makeAppData();
  const history = raw.history.map((item) => {
    const session = makeSession({
      id: item.id,
      date: item.date,
      templateId: item.templateId,
      exerciseId: item.exerciseId,
      setSpecs: item.sets,
    });
    return item.loadFeedback ? upsertLoadFeedback(session, item.exerciseId, item.loadFeedback) : session;
  });

  return makeAppData({
    selectedTemplateId: raw.selectedTemplateId,
    trainingMode: raw.trainingMode,
    todayStatus: { ...base.todayStatus, ...raw.todayStatus },
    history,
    userProfile: { ...base.userProfile, ...raw.userProfile },
    programTemplate: { ...base.programTemplate, primaryGoal: raw.userProfile.primaryGoal },
  });
};

describe('recommendationDiffEngine', () => {
  it('reports identical contexts as comparable and stable', () => {
    const context = withGoalMode('legs-a', 'hypertrophy', 'hybrid');
    const report = buildRecommendationDifferenceExplanation(context, context);

    expect(report.isComparable).toBe(true);
    expect(report.sameSettings).toBe(true);
    expect(report.differences).toHaveLength(0);
    expect(report.possibleBugWarnings).toHaveLength(0);
    expect(getStableRecommendationSignature(context)).toEqual(getStableRecommendationSignature(context));
  });

  it('explains primary goal, training mode, history and readiness differences', () => {
    const hypertrophy = withGoalMode('legs-a', 'hypertrophy', 'hypertrophy', {
      history: [
        makeSession({
          id: 'leg-history',
          date: '2026-04-27',
          templateId: 'legs-a',
          exerciseId: 'squat',
          setSpecs: [{ weight: 90, reps: 6, rir: 2 }],
        }),
      ],
    });
    const fatLossHybrid = withGoalMode('legs-a', 'fat_loss', 'hybrid', {
      todayStatus: { ...makeAppData().todayStatus, sleep: '差', energy: '低' },
      history: [
        makeSession({
          id: 'push-history',
          date: '2026-04-27',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 85, reps: 5, rir: 1 }],
        }),
      ],
    });

    const report = buildRecommendationDifferenceExplanation(hypertrophy, fatLossHybrid);
    const categories = report.differences.map((item) => item.category);

    expect(categories).toContain('primaryGoal');
    expect(categories).toContain('trainingMode');
    expect(categories).toContain('history');
    expect(categories).toContain('readiness');
    expect(report.summary).toContain('减脂 + 综合');
    expect(report.possibleBugWarnings).toHaveLength(0);
  });

  it('keeps synonym goals comparable and does not treat fat loss plus hybrid as a bug', () => {
    const base = withGoalMode('push-a', 'hypertrophy', 'hypertrophy');
    const alias = {
      ...withGoalMode('push-a', 'hypertrophy', 'hypertrophy'),
      primaryGoal: '增肌',
      trainingMode: '肌肥大',
    };
    const aliasReport = buildRecommendationDifferenceExplanation(base, alias);
    const fatLossReport = buildRecommendationDifferenceExplanation(base, withGoalMode('push-a', 'fat_loss', 'hybrid'));

    expect(aliasReport.differences.some((item) => item.category === 'primaryGoal')).toBe(false);
    expect(aliasReport.differences.some((item) => item.category === 'trainingMode')).toBe(false);
    expect(fatLossReport.possibleBugWarnings).toHaveLength(0);
    expect(fatLossReport.summary).toContain('减脂 + 综合');
  });

  it('limits load feedback explanations to matching exercise pools', () => {
    const heavyBenchHistory = [0, 1].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `bench-heavy-${index}`,
          date: `2026-04-2${index}`,
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

    expect(getStableRecommendationSignature(legsWithBenchFeedback)).toEqual(getStableRecommendationSignature(legsBaseline));
    expect(getStableRecommendationSignature(pushWithBenchFeedback).find((item) => item.id === 'bench-press')?.conservative).toBe(true);
  });

  it('uses privacy-free dual-user fixtures to explain expected differences', () => {
    const hypertrophyUser = loadUserComparisonFixture('hypertrophy_user');
    const fatLossHybridUser = loadUserComparisonFixture('fat_loss_hybrid_user');
    const report = buildRecommendationDifferenceExplanation(hypertrophyUser, fatLossHybridUser);

    expect(report.isComparable).toBe(true);
    expect(report.differences.length).toBeGreaterThan(0);
    expect(report.differences.map((item) => item.category)).toContain('primaryGoal');
    expect(report.differences.map((item) => item.category)).toContain('trainingMode');
    expect(report.possibleBugWarnings).toHaveLength(0);
  });
});
