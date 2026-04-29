import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import type { PainPattern, ReadinessResult, TrainingSession } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const completedSession = (id: string, date: string, templateId: string, exerciseId: string, dataFlag?: TrainingSession['dataFlag']) => ({
  ...makeSession({
    id,
    date,
    templateId,
    exerciseId,
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
  dataFlag,
});

const visibleText = (recommendation: ReturnType<typeof buildNextWorkoutRecommendation>) =>
  [
    recommendation.templateName,
    recommendation.reason,
    ...recommendation.warnings,
    ...recommendation.alternatives.flatMap((item) => [item.templateName, item.reason]),
  ].join('\n');

describe('nextWorkoutScheduler', () => {
  it('does not recommend Legs A again after completing Legs A', () => {
    const data = makeAppData({
      history: [completedSession('legs-done', '2026-04-28', 'legs-a', 'squat')],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      trainingMode: data.trainingMode,
    });

    expect(recommendation.templateId).not.toBe('legs-a');
    expect(recommendation.templateId).toBe('push-a');
    expect(recommendation.templateName).toContain('A');
    expect(recommendation.reason).toContain('轮转');
  });

  it('recommends the next template in order after Push A', () => {
    const data = makeAppData({
      history: [completedSession('push-done', '2026-04-28', 'push-a', 'bench-press')],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      trainingMode: data.trainingMode,
    });

    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.confidence).toBe('high');
    expect(recommendation.warnings).toEqual([]);
  });

  it('ignores test and excluded sessions when rotating', () => {
    const data = makeAppData({
      history: [
        completedSession('excluded-legs', '2026-04-29', 'legs-a', 'squat', 'excluded'),
        completedSession('test-pull', '2026-04-28', 'pull-a', 'lat-pulldown', 'test'),
        completedSession('normal-push', '2026-04-27', 'push-a', 'bench-press', 'normal'),
      ],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.reason).toContain('推');
  });

  it('avoids a painful area when choosing the next workout', () => {
    const data = makeAppData({
      history: [completedSession('push-done', '2026-04-28', 'push-a', 'bench-press')],
    });
    const backPain: PainPattern = {
      area: 'back',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      painPatterns: [backPain],
    });

    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.warnings.join('\n')).toContain('不适');
    expect(recommendation.reason).toContain('近期不适');
  });

  it('keeps completed today state separate from the next recommendation', () => {
    const session = completedSession('today-legs', '2026-04-28', 'legs-a', 'squat');
    const data = makeAppData({ history: [session], selectedTemplateId: 'legs-a' });
    const todayState = buildTodayTrainingState({
      history: data.history,
      activeSession: data.activeSession,
      currentLocalDate: '2026-04-28',
      plannedTemplateId: data.selectedTemplateId,
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      todayState,
    });

    expect(todayState.status).toBe('completed');
    expect(recommendation.templateId).toBe('push-a');
    expect(recommendation.reason).toContain('下次建议');
    expect(recommendation.reason).toContain('不会覆盖今天已经完成的训练状态');
  });

  it('prioritizes continuing active training instead of generating an overriding next suggestion', () => {
    const activeSession = {
      ...completedSession('active-pull', '2026-04-28', 'pull-a', 'lat-pulldown'),
      completed: false,
    };
    const data = makeAppData({ activeSession });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      activeSession: data.activeSession,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.reason).toContain('继续');
    expect(recommendation.reason).toContain('不会生成覆盖当前训练');
    expect(recommendation.alternatives).toEqual([]);
  });

  it('uses readiness as a conservative warning without deleting the workout', () => {
    const data = makeAppData({
      history: [completedSession('pull-done', '2026-04-28', 'pull-a', 'lat-pulldown')],
    });
    const lowReadiness: ReadinessResult = {
      score: 42,
      level: 'low',
      trainingAdjustment: 'recovery',
      reasons: ['睡眠不足'],
    };

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      readinessResult: lowReadiness,
    });

    expect(recommendation.templateId).toBeTruthy();
    expect(recommendation.warnings.join('\n')).toContain('准备度较低');
    expect(recommendation.reason).toContain('低负荷');
  });

  it('uses today soreness to avoid high-conflict templates', () => {
    const recommendation = buildNextWorkoutRecommendation({
      templates: [getTemplate('upper'), getTemplate('legs-a')],
      sorenessAreas: ['肩部'],
    });

    expect(recommendation.kind).toBe('train');
    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.conflictLevel).toBe('high');
    expect(recommendation.warnings.join('\n')).toContain('肩部');
  });

  it('returns Chinese explanation text without raw enum leakage', () => {
    const data = makeAppData({
      history: [completedSession('push-done', '2026-04-28', 'push-a', 'bench-press')],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      trainingMode: 'hybrid',
    });
    const text = visibleText(recommendation);

    expect(text).not.toMatch(/\b(push-a|pull-a|legs-a|hybrid|strength|hypertrophy|undefined|null)\b/i);
    expect(text).toMatch(/[推拉腿综合轮转下次建议]/);
  });
});
