import { describe, expect, it } from 'vitest';
import { buildRecommendationTrace, getRecommendationTraceReasons, type RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const visibleTraceText = (trace: RecommendationTrace) =>
  [
    trace.primaryGoal,
    trace.trainingMode,
    trace.trainingLevel,
    trace.finalSummary,
    ...trace.globalFactors.flatMap((factor) => [factor.label, factor.reason]),
    ...trace.volumeFactors.flatMap((factor) => [factor.label, factor.reason]),
    ...trace.loadFeedbackFactors.flatMap((factor) => [factor.label, factor.reason]),
    ...Object.values(trace.exerciseFactors)
      .flat()
      .flatMap((factor) => [factor.label, factor.reason]),
  ].join(' ');

describe('recommendationTraceEngine', () => {
  it('builds a Chinese trace without changing the recommendation result', () => {
    const base = makeAppData();
    const template = getTemplate('push-a');
    const history = [0, 1].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `bench-feedback-${index}`,
          date: `2026-04-2${index}`,
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 1, techniqueQuality: 'acceptable' }],
        }),
        'bench-press',
        'too_heavy',
      ),
    );
    const trace = buildRecommendationTrace({
      ...makeAppData({
        selectedTemplateId: 'push-a',
        trainingMode: 'hybrid',
        history,
        userProfile: { ...base.userProfile, primaryGoal: 'fat_loss' },
        programTemplate: { ...base.programTemplate, primaryGoal: 'fat_loss' },
      }),
      template,
    });

    expect(trace.sessionTemplateId).toBe('push-a');
    expect(trace.primaryGoal).toBe('减脂');
    expect(trace.trainingMode).toBe('综合');
    expect(trace.globalFactors.some((factor) => factor.source === 'primaryGoal')).toBe(true);
    expect(trace.globalFactors.some((factor) => factor.source === 'trainingMode')).toBe(true);
    expect(trace.volumeFactors.length).toBeGreaterThan(0);
    expect(trace.exerciseFactors['bench-press']?.length).toBeGreaterThan(0);
    expect(trace.loadFeedbackFactors.some((factor) => factor.source === 'loadFeedback')).toBe(true);
    expect(visibleTraceText(trace)).not.toMatch(/\b(fat_loss|hybrid|hypertrophy|strength|undefined|null)\b/);
  });

  it('explains conservative behavior while the training baseline is still unknown', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({ selectedTemplateId: 'legs-a', trainingMode: 'hybrid', history: [] }),
      template: getTemplate('legs-a'),
    });
    const levelFactor = trace.globalFactors.find((factor) => factor.source === 'trainingLevel');

    expect(levelFactor?.effect).toBe('decrease');
    expect(levelFactor?.reason).toContain('训练基线');
    expect(getRecommendationTraceReasons(trace).join(' ')).toContain('训练基线');
  });

  it('keeps imported health data as a global readiness signal instead of an exercise prescription source', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        selectedTemplateId: 'legs-a',
        trainingMode: 'hybrid',
        importedWorkoutSamples: [
          {
            id: 'external-run',
            source: 'apple_health_export',
            workoutType: 'running',
            startDate: '2026-04-27T08:00:00.000Z',
            endDate: '2026-04-27T08:40:00.000Z',
            durationMin: 40,
            activeEnergyKcal: 360,
            importedAt: '2026-04-27T09:00:00.000Z',
          },
        ],
      }),
      template: getTemplate('legs-a'),
    });

    expect(trace.globalFactors.some((factor) => factor.source === 'healthData')).toBe(true);
    expect(Object.values(trace.exerciseFactors).flat().some((factor) => factor.source === 'healthData')).toBe(false);
  });
});
