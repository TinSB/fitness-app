import { describe, expect, it } from 'vitest';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from '../src/engines/trainingDecisionContext';
import type { HealthMetricSample } from '../src/models/training-model';
import { makeAppData } from './fixtures';

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
    expect(context.healthSummary).toBeUndefined();
    expect(toStatusRulesDecisionContext(context).healthSummary).toBeUndefined();
  });

  it('keeps existing behavior when there is no imported health data', () => {
    const context = buildTrainingDecisionContext(makeAppData());

    expect(context.healthSummary).toBeUndefined();
    expect(context.history).toEqual([]);
    expect(context.trainingMode).toBe('hybrid');
  });
});
