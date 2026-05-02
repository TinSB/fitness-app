import { describe, expect, it } from 'vitest';
import { buildCoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import { todayKey } from '../src/engines/engineUtils';
import type { AppData, HealthMetricSample, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession, makeStatus } from './fixtures';

const completedSession = (templateId: string, exerciseId: string, date = todayKey()): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId,
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
});

const lowSleepSample = (): HealthMetricSample => ({
  id: 'sleep-low-today',
  source: 'manual_import',
  metricType: 'sleep_duration',
  startDate: new Date().toISOString(),
  value: 5.2,
  unit: 'h',
  importedAt: new Date().toISOString(),
});

const visibleText = (summary: ReturnType<typeof buildCoachAutomationSummary>) =>
  [
    ...summary.keyWarnings,
    ...(summary.todayAdjustment ? [summary.todayAdjustment.title, summary.todayAdjustment.summary, ...summary.todayAdjustment.reasons] : []),
    ...(summary.nextWorkout ? [summary.nextWorkout.templateName, summary.nextWorkout.reason, ...summary.nextWorkout.warnings] : []),
    ...(summary.dataHealth ? [summary.dataHealth.summary, ...summary.dataHealth.issues.flatMap((issue) => [issue.title, issue.message])] : []),
    ...summary.recommendedActions.flatMap((action) => [action.label, action.reason]),
  ].join('\n');

describe('coachAutomationEngine', () => {
  it('returns a low-noise summary for normal data', () => {
    const data = makeAppData({
      todayStatus: makeStatus({ sleep: '好', energy: '高', time: '90' }),
      history: [
        completedSession('push-a', 'bench-press', '2026-04-01'),
        completedSession('pull-a', 'lat-pulldown', '2026-04-03'),
        completedSession('legs-a', 'squat', '2026-04-05'),
        completedSession('push-a', 'bench-press', '2026-04-08'),
        completedSession('pull-a', 'lat-pulldown', '2026-04-10'),
        completedSession('legs-a', 'squat', '2026-04-12'),
      ],
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.dataHealth?.status).toBe('healthy');
    expect(summary.keyWarnings).toEqual([]);
    expect(summary.recommendedActions).toEqual([]);
    expect(summary.todayAdjustment?.type).toBe('normal');
  });

  it('prioritizes data health errors', () => {
    const broken = completedSession('push-a', 'bench-press');
    broken.exercises[0].actualExerciseId = 'bench-press__auto_alt';
    const data = makeAppData({ history: [broken] });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.dataHealth?.status).toBe('has_errors');
    expect(summary.recommendedActions[0]?.actionType).toBe('review_data');
    expect(summary.recommendedActions[0]?.label).toContain('数据');
    expect(summary.keyWarnings[0]).toContain('动作记录身份需要检查');
  });

  it('outputs a daily adjustment when readiness is low', () => {
    const data = makeAppData({
      healthMetricSamples: [lowSleepSample()],
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.todayAdjustment?.type).toBe('conservative');
    expect(summary.recommendedActions.some((action) => action.actionType === 'apply_daily_adjustment')).toBe(true);
    expect(summary.recommendedActions.find((action) => action.actionType === 'apply_daily_adjustment')?.requiresConfirmation).toBe(true);
  });

  it('outputs the next workout after a completed session', () => {
    const data = makeAppData({
      history: [completedSession('legs-a', 'squat')],
      selectedTemplateId: 'legs-a',
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.nextWorkout?.templateId).toBe('push-a');
    expect(summary.recommendedActions.some((action) => action.actionType === 'open_next_workout')).toBe(true);
    expect(summary.recommendedActions.find((action) => action.actionType === 'open_next_workout')?.label).toContain('下次训练');
  });

  it('does not interrupt an active session with daily or next-workout actions', () => {
    const activeSession = {
      ...completedSession('push-a', 'bench-press'),
      completed: false,
    };
    const data = makeAppData({
      activeSession,
      healthMetricSamples: [lowSleepSample()],
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.todayAdjustment).toBeUndefined();
    expect(summary.recommendedActions.some((action) => action.actionType === 'apply_daily_adjustment')).toBe(false);
    expect(summary.recommendedActions.some((action) => action.actionType === 'open_next_workout')).toBe(false);
  });

  it('does not mutate AppData', () => {
    const data = makeAppData({
      history: [completedSession('pull-a', 'lat-pulldown')],
      healthMetricSamples: [lowSleepSample()],
    });
    const before = JSON.stringify(data);

    buildCoachAutomationSummary(data);

    expect(JSON.stringify(data)).toBe(before);
  });

  it('keeps visible output Chinese and avoids raw enum leakage', () => {
    const data = makeAppData({
      history: [completedSession('legs-a', 'squat')],
      healthMetricSamples: [lowSleepSample()],
    }) as AppData;

    const text = visibleText(buildCoachAutomationSummary(data));

    expect(text).not.toMatch(/\b(review_data|apply_daily_adjustment|open_next_workout|conservative|fat_loss|hybrid|undefined|null)\b/);
    expect(text).toMatch(/[数据训练建议保守下次]/);
  });
});
