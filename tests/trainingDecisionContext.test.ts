import { describe, expect, it } from 'vitest';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from '../src/engines/trainingDecisionContext';
import type { HealthMetricSample } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const sleepSample = (overrides: Partial<HealthMetricSample> = {}): HealthMetricSample => ({
  id: 'sleep-1',
  source: 'apple_health_export',
  metricType: 'sleep_duration',
  startDate: '2026-04-27T07:00:00.000Z',
  endDate: '2026-04-27T07:00:00.000Z',
  value: 5.5,
  unit: 'h',
  importedAt: '2026-04-27T08:00:00.000Z',
  dataFlag: 'normal',
  ...overrides,
});

describe('trainingDecisionContext', () => {
  it('builds one shared health summary when health integration is enabled', () => {
    const data = makeAppData({
      healthMetricSamples: [sleepSample()],
      settings: {
        healthIntegrationSettings: {
          useHealthDataForReadiness: true,
          showExternalWorkoutsInCalendar: true,
        },
      },
    });
    const context = buildTrainingDecisionContext(data);

    expect(context.useHealthDataForReadiness).toBe(true);
    expect(context.healthSummary?.latestSleepHours).toBe(5.5);
    expect(toStatusRulesDecisionContext(context).healthSummary?.latestSleepHours).toBe(5.5);
  });

  it('removes health summary from readiness paths when health integration is disabled', () => {
    const data = makeAppData({
      healthMetricSamples: [sleepSample()],
      settings: {
        healthIntegrationSettings: {
          useHealthDataForReadiness: false,
          showExternalWorkoutsInCalendar: true,
        },
      },
    });
    const context = buildTrainingDecisionContext(data);

    expect(context.useHealthDataForReadiness).toBe(false);
    expect(context.healthSummary?.latestSleepHours).toBe(5.5);
    expect(toStatusRulesDecisionContext(context).healthSummary).toBeUndefined();
  });

  it('keeps existing behavior when there is no imported health data', () => {
    const context = buildTrainingDecisionContext(makeAppData());

    expect(context.healthSummary?.confidence).toBe('low');
    expect(context.history).toEqual([]);
    expect(context.trainingMode).toBe('hybrid');
    expect(context.trainingLevelAssessment.level).toBe(context.trainingLevel);
  });

  it('separates normal history from test and excluded sessions', () => {
    const push = makeSession({
      id: 'push-normal',
      date: '2026-04-27',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6 }],
    });
    const test = {
      ...makeSession({
        id: 'pull-test',
        date: '2026-04-28',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 70, reps: 8 }],
      }),
      dataFlag: 'test' as const,
    };
    const excluded = {
      ...makeSession({
        id: 'legs-excluded',
        date: '2026-04-29',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [{ weight: 90, reps: 5 }],
      }),
      dataFlag: 'excluded' as const,
    };

    const context = buildTrainingDecisionContext(makeAppData({ history: [push, test, excluded] }), '2026-04-30');

    expect(context.normalHistory.map((session) => session.id)).toEqual(['push-normal']);
    expect(context.testExcludedHistory.map((session) => session.id).sort()).toEqual(['legs-excluded', 'pull-test']);
    expect(context.history).toBe(context.normalHistory);
  });

  it('resolves the active program template and unit settings in one context', () => {
    const data = makeAppData({
      activeProgramTemplateId: 'pull-a',
      selectedTemplateId: 'push-a',
      unitSettings: { weightUnit: 'lb', bodyWeightUnit: 'lb', displayPrecision: 1 },
    });

    const context = buildTrainingDecisionContext(data, '2026-04-30');

    expect(context.activeProgramTemplateId).toBe('pull-a');
    expect(context.currentTrainingTemplate?.id).toBe(getTemplate('pull-a').id);
    expect(context.unitSettings.weightUnit).toBe('lb');
    expect(
      [
        context.currentDateLocalKey,
        context.selectedTemplateId,
        context.trainingMode,
        context.primaryGoal,
        context.currentProgramTemplate.id,
      ].join('\n'),
    ).not.toMatch(/\bundefined|null\b/);
  });
});
