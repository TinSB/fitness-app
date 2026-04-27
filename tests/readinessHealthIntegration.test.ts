import { describe, expect, it } from 'vitest';
import { parseAppleHealthXml } from '../src/engines/appleHealthXmlImportEngine';
import type { HealthSummary } from '../src/engines/healthSummaryEngine';
import { buildHealthSummary } from '../src/engines/healthSummaryEngine';
import { buildReadinessResult } from '../src/engines/readinessEngine';
import type { ReadinessInput } from '../src/models/training-model';

const baseInput: ReadinessInput = {
  sleep: 'good',
  energy: 'high',
  sorenessAreas: [],
  painAreas: [],
  availableTimeMin: 90,
  plannedTimeMin: 60,
};

const baseHealthSummary: HealthSummary = {
  recentWorkoutCount: 0,
  recentWorkoutMinutes: 0,
  recentHighActivityDays: 0,
  notes: ['导入健康数据仅作恢复/活动负荷参考。'],
  confidence: 'medium',
};

describe('readiness health integration', () => {
  it('low sleep lowers readiness slightly when imported data has enough confidence', () => {
    const baseline = buildReadinessResult(baseInput);
    const withHealth = buildReadinessResult(baseInput, {
      healthSummary: { ...baseHealthSummary, latestSleepHours: 5.5 },
    });

    expect(withHealth.score).toBeLessThan(baseline.score);
    expect(baseline.score - withHealth.score).toBeLessThanOrEqual(5);
    expect(withHealth.reasons.join(' ')).toContain('睡眠偏少');
  });

  it('high previous activity adds a conservative note without forcing deload', () => {
    const result = buildReadinessResult(baseInput, {
      healthSummary: {
        ...baseHealthSummary,
        activityLoad: {
          previous24hWorkoutMinutes: 90,
          previous48hWorkoutMinutes: 90,
          recent7dWorkoutMinutes: 90,
          previous24hHighActivity: true,
          previous48hHighActivity: true,
        },
      },
    });

    expect(result.trainingAdjustment).not.toBe('recovery');
    expect(result.reasons.join(' ')).toContain('过去 24 小时外部活动量较高');
  });

  it('insufficient imported health data does not strongly affect readiness', () => {
    const baseline = buildReadinessResult(baseInput);
    const result = buildReadinessResult(baseInput, {
      healthSummary: { ...baseHealthSummary, latestSleepHours: 4, recentWorkoutMinutes: 180, confidence: 'low' },
    });

    expect(baseline.score - result.score).toBeLessThanOrEqual(2);
    expect(result.reasons.join(' ')).toContain('健康数据不足');
  });

  it('can disable imported health data for readiness', () => {
    const baseline = buildReadinessResult(baseInput);
    const result = buildReadinessResult(baseInput, {
      useHealthDataForReadiness: false,
      healthSummary: { ...baseHealthSummary, latestSleepHours: 4, recentWorkoutMinutes: 180 },
    });

    expect(result.score).toBe(baseline.score);
    expect(result.reasons.join(' ')).not.toContain('健康数据');
  });

  it('uses XML imported sleep, HRV and RHR as auxiliary readiness signals', () => {
    const imported = parseAppleHealthXml(
      `<?xml version="1.0"?><HealthData>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-20 23:00:00 +0000" endDate="2026-04-21 04:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-18 07:00:00 +0000" endDate="2026-04-18 07:00:00 +0000" value="55"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-19 07:00:00 +0000" endDate="2026-04-19 07:00:00 +0000" value="56"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-20 07:00:00 +0000" endDate="2026-04-20 07:00:00 +0000" value="55"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-21 07:00:00 +0000" endDate="2026-04-21 07:00:00 +0000" value="63"/>
        <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-18 07:05:00 +0000" endDate="2026-04-18 07:05:00 +0000" value="60"/>
        <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-19 07:05:00 +0000" endDate="2026-04-19 07:05:00 +0000" value="61"/>
        <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-20 07:05:00 +0000" endDate="2026-04-20 07:05:00 +0000" value="60"/>
        <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-21 07:05:00 +0000" endDate="2026-04-21 07:05:00 +0000" value="48"/>
      </HealthData>`,
      'export.xml'
    );
    const summary = buildHealthSummary(imported.samples, [], { endDate: '2026-04-22T00:00:00.000Z' });
    const result = buildReadinessResult(baseInput, { healthSummary: summary });

    expect(result.reasons.join(' ')).toContain('睡眠偏少');
    expect(result.reasons.join(' ')).toContain('恢复可能偏低');
  });
});
