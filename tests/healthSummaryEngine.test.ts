import { describe, expect, it } from 'vitest';
import { parseAppleHealthXml } from '../src/engines/appleHealthXmlImportEngine';
import { buildHealthSummary } from '../src/engines/healthSummaryEngine';
import type { HealthMetricSample, ImportedWorkoutSample } from '../src/models/training-model';

const sample = (overrides: Partial<HealthMetricSample>): HealthMetricSample => ({
  id: overrides.id || `sample-${overrides.metricType}-${overrides.startDate}`,
  source: overrides.source || 'apple_health_export',
  metricType: overrides.metricType || 'steps',
  startDate: overrides.startDate || '2026-04-21T07:00:00.000Z',
  value: overrides.value ?? 1,
  unit: overrides.unit || 'count',
  importedAt: overrides.importedAt || '2026-04-21T08:00:00.000Z',
  dataFlag: overrides.dataFlag || 'normal',
});

const workout = (overrides: Partial<ImportedWorkoutSample>): ImportedWorkoutSample => ({
  id: overrides.id || `workout-${overrides.startDate}`,
  source: overrides.source || 'apple_watch_workout',
  workoutType: overrides.workoutType || '户外跑步',
  startDate: overrides.startDate || '2026-04-21T18:00:00.000Z',
  endDate: overrides.endDate || '2026-04-21T18:35:00.000Z',
  durationMin: overrides.durationMin ?? 35,
  activeEnergyKcal: overrides.activeEnergyKcal,
  importedAt: overrides.importedAt || '2026-04-21T20:00:00.000Z',
  dataFlag: overrides.dataFlag || 'normal',
});

describe('healthSummaryEngine', () => {
  it('summarizes recent sleep, RHR, HRV and activity', () => {
    const summary = buildHealthSummary(
      [
        sample({ metricType: 'sleep_duration', value: 6.5, unit: 'h' }),
        sample({ metricType: 'resting_heart_rate', value: 58, unit: 'bpm' }),
        sample({ metricType: 'hrv', value: 52, unit: 'ms' }),
        sample({ metricType: 'steps', value: 9000 }),
        sample({ metricType: 'body_weight', value: 180, unit: 'lb' }),
      ],
      [workout({ durationMin: 45, activeEnergyKcal: 410 })],
      { endDate: '2026-04-22T00:00:00.000Z' }
    );

    expect(summary.latestSleepHours).toBe(6.5);
    expect(summary.latestRestingHeartRate).toBe(58);
    expect(summary.latestHrv).toBe(52);
    expect(summary.latestSteps).toBe(9000);
    expect(summary.latestBodyWeightKg).toBeGreaterThan(80);
    expect(summary.recentWorkoutCount).toBe(1);
    expect(summary.recentWorkoutMinutes).toBe(45);
  });

  it('ignores excluded data', () => {
    const summary = buildHealthSummary(
      [sample({ metricType: 'sleep_duration', value: 4, unit: 'h', dataFlag: 'excluded' })],
      [workout({ durationMin: 90, dataFlag: 'excluded' })],
      { endDate: '2026-04-22T00:00:00.000Z' }
    );

    expect(summary.latestSleepHours).toBeUndefined();
    expect(summary.recentWorkoutCount).toBe(0);
  });

  it('marks insufficient data as low confidence', () => {
    const summary = buildHealthSummary([], [], { endDate: '2026-04-22T00:00:00.000Z' });

    expect(summary.confidence).toBe('low');
    expect(summary.notes.join(' ')).toContain('仅作恢复/活动负荷参考');
  });

  it('adds conservative notes when RHR rises or HRV drops versus imported baseline', () => {
    const summary = buildHealthSummary(
      [
        sample({ id: 'rhr-1', metricType: 'resting_heart_rate', value: 55, startDate: '2026-04-18T07:00:00.000Z', unit: 'bpm' }),
        sample({ id: 'rhr-2', metricType: 'resting_heart_rate', value: 56, startDate: '2026-04-19T07:00:00.000Z', unit: 'bpm' }),
        sample({ id: 'rhr-3', metricType: 'resting_heart_rate', value: 55, startDate: '2026-04-20T07:00:00.000Z', unit: 'bpm' }),
        sample({ id: 'rhr-4', metricType: 'resting_heart_rate', value: 63, startDate: '2026-04-21T07:00:00.000Z', unit: 'bpm' }),
        sample({ id: 'hrv-1', metricType: 'hrv', value: 60, startDate: '2026-04-18T07:00:00.000Z', unit: 'ms' }),
        sample({ id: 'hrv-2', metricType: 'hrv', value: 62, startDate: '2026-04-19T07:00:00.000Z', unit: 'ms' }),
        sample({ id: 'hrv-3', metricType: 'hrv', value: 61, startDate: '2026-04-20T07:00:00.000Z', unit: 'ms' }),
        sample({ id: 'hrv-4', metricType: 'hrv', value: 48, startDate: '2026-04-21T07:00:00.000Z', unit: 'ms' }),
      ],
      [],
      { endDate: '2026-04-22T00:00:00.000Z' }
    );

    expect(summary.notes.join(' ')).toContain('静息心率高于');
    expect(summary.notes.join(' ')).toContain('HRV 低于');
  });

  it('summarizes XML-imported samples', () => {
    const imported = parseAppleHealthXml(
      `<?xml version="1.0"?><HealthData>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-21 07:00:00 +0000" endDate="2026-04-21 07:00:00 +0000" value="60"/>
        <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-21 07:05:00 +0000" endDate="2026-04-21 07:05:00 +0000" value="50"/>
      </HealthData>`,
      'export.xml'
    );
    const summary = buildHealthSummary(imported.samples, [], { endDate: '2026-04-22T00:00:00.000Z' });

    expect(summary.latestRestingHeartRate).toBe(60);
    expect(summary.latestHrv).toBe(50);
  });
});
