import { describe, expect, it } from 'vitest';
import { parseAppleHealthXml } from '../src/engines/appleHealthXmlImportEngine';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="zh_CN">
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-20 07:00:00 +0000" endDate="2026-04-20 07:00:00 +0000" value="58"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-20 07:05:00 +0000" endDate="2026-04-20 07:05:00 +0000" value="51"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="lb" startDate="2026-04-20 08:00:00 +0000" endDate="2026-04-20 08:00:00 +0000" value="180"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-19 23:00:00 +0000" endDate="2026-04-20 01:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-20 01:00:00 +0000" endDate="2026-04-20 02:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-20 02:00:00 +0000" endDate="2026-04-20 03:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-20 03:30:00 +0000" endDate="2026-04-20 04:00:00 +0000" value="HKCategoryValueSleepAnalysisAwake"/>
  <Record type="HKQuantityTypeIdentifierUnsupported" sourceName="Apple Watch" unit="count" startDate="2026-04-20 12:00:00 +0000" endDate="2026-04-20 12:00:00 +0000" value="1"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" sourceName="Apple Watch" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" duration="35" durationUnit="min">
    <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" sum="320" unit="kcal"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" sum="5" unit="km"/>
  </Workout>
</HealthData>`;

describe('appleHealthXmlImportEngine', () => {
  it('parses key Apple Health records', () => {
    const result = parseAppleHealthXml(xml, 'export.xml');

    expect(result.samples.find((sample) => sample.metricType === 'resting_heart_rate')?.value).toBe(58);
    expect(result.samples.find((sample) => sample.metricType === 'resting_heart_rate')?.unit).toBe('bpm');
    expect(result.samples.find((sample) => sample.metricType === 'resting_heart_rate')?.source).toBe('apple_health_export');
    expect(result.samples.find((sample) => sample.metricType === 'resting_heart_rate')?.deviceSourceName).toBe('Apple Watch');
    expect(result.samples.find((sample) => sample.metricType === 'hrv')?.value).toBe(51);
    expect(result.samples.find((sample) => sample.metricType === 'steps')?.value).toBe(3200);
    expect(result.samples.find((sample) => sample.metricType === 'body_weight')?.value).toBeGreaterThan(81);
    expect(result.summary.detectedRecordCount).toBeGreaterThan(0);
  });

  it('aggregates asleep sleep analysis into sleep duration', () => {
    const result = parseAppleHealthXml(xml, 'export.xml');
    const sleep = result.samples.find((sample) => sample.metricType === 'sleep_duration');

    expect(sleep?.unit).toBe('h');
    expect(sleep?.value).toBe(4.5);
    expect((sleep?.raw as { day?: string } | undefined)?.day).toBe('2026-04-20');
    expect(sleep?.batchId).toBe(result.batch.id);
  });

  it('assigns cross-midnight sleep to wake date and avoids overlapping duplicate duration', () => {
    const result = parseAppleHealthXml(
      `<?xml version="1.0"?><HealthData>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-27 23:30:00 +0000" endDate="2026-04-28 02:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 01:30:00 +0000" endDate="2026-04-28 03:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 03:00:00 +0000" endDate="2026-04-28 07:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 07:00:00 +0000" endDate="2026-04-28 07:15:00 +0000" value="HKCategoryValueSleepAnalysisAwake"/>
      </HealthData>`,
      'export.xml'
    );
    const sleep = result.samples.find((sample) => sample.metricType === 'sleep_duration');

    expect((sleep?.raw as { day?: string } | undefined)?.day).toBe('2026-04-28');
    expect(sleep?.value).toBe(7.5);
  });

  it('parses workouts as imported external activity', () => {
    const result = parseAppleHealthXml(xml, 'export.xml');

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]?.workoutType).toBe('跑步');
    expect(result.workouts[0]?.durationMin).toBe(35);
    expect(result.workouts[0]?.activeEnergyKcal).toBe(320);
    expect(result.workouts[0]?.distanceMeters).toBe(5000);
  });

  it('warns for unsupported record types', () => {
    const result = parseAppleHealthXml(xml, 'export.xml');

    expect(result.warnings.some((warning) => warning.includes('未支持'))).toBe(true);
  });

  it('filters by date range and metric types', () => {
    const result = parseAppleHealthXml(xml, 'export.xml', {
      fromDate: '2026-04-20T06:00:00.000Z',
      toDate: '2026-04-20T08:00:00.000Z',
      metricTypes: ['resting_heart_rate'],
      includeWorkouts: false,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]?.metricType).toBe('resting_heart_rate');
    expect(result.workouts).toHaveLength(0);
  });

  it('dedupes duplicate samples', () => {
    const duplicated = `<?xml version="1.0"?><HealthData>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>
    </HealthData>`;
    const result = parseAppleHealthXml(duplicated, 'export.xml');

    expect(result.samples).toHaveLength(1);
  });

  it('does not crash on invalid XML', () => {
    const result = parseAppleHealthXml('<not-health></not-health>', 'export.xml');

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toContain('不是有效的 Apple Health');
  });

  it('handles malformed Apple Health XML without continuing into partial data', () => {
    const result = parseAppleHealthXml(
      '<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-04-20 10:00:00 +0000" value="1000"/>',
      'export.xml',
    );

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings.join(' ')).toContain('结构不完整');
  });

  it('handles parsererror XML as a warning instead of throwing', () => {
    const result = parseAppleHealthXml('<?xml version="1.0"?><HealthData><parsererror>bad xml</parsererror></HealthData>', 'export.xml');

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings.join(' ')).toContain('无法解析');
  });

  it('handles supported root with no supported data', () => {
    const result = parseAppleHealthXml('<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierUnknown" value="1"/></HealthData>', 'export.xml');

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings.join(' ')).toContain('未支持');
  });

  it('does not store full XML text or oversized attributes in raw data', () => {
    const result = parseAppleHealthXml(
      `<?xml version="1.0"?><HealthData>
        <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200" xmlText="${'x'.repeat(2000)}" metadata="${'y'.repeat(2000)}"/>
      </HealthData>`,
      'export.xml',
    );
    const rawText = JSON.stringify(result.samples[0]?.raw || {});

    expect(rawText).not.toContain('xmlText');
    expect(rawText).not.toContain('metadata');
    expect(rawText.length).toBeLessThan(1000);
    expect(JSON.stringify(result.batch)).not.toContain('<HealthData');
  });
});
