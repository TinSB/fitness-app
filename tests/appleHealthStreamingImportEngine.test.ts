import { describe, expect, it } from 'vitest';
import {
  parseAppleHealthXmlStreaming,
  parseXmlAttributes,
} from '../src/engines/appleHealthStreamingImportEngine';

const makeXml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><HealthData locale="zh_CN">${body}</HealthData>`;
const blobOf = (text: string) => new Blob([text], { type: 'text/xml' });

describe('appleHealthStreamingImportEngine', () => {
  it('parses XML attributes without a full DOM parser', () => {
    const attrs = parseXmlAttributes('<Record type="HKQuantityTypeIdentifierStepCount" sourceName="A &amp; B" value="100"/>');

    expect(attrs.type).toBe('HKQuantityTypeIdentifierStepCount');
    expect(attrs.sourceName).toBe('A & B');
    expect(attrs.value).toBe('100');
  });

  it('handles tags split across chunks', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml('<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>')),
      'export.xml',
      { chunkSize: 23 },
    );

    expect(result.summary.detectedRecordCount).toBe(1);
    expect(result.samples[0]?.metricType).toBe('steps');
    expect(result.samples[0]?.value).toBe(3200);
  });

  it('filters by date range while scanning', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml(`
        <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2025-01-01 10:00:00 +0000" endDate="2025-01-01 10:10:00 +0000" value="9999"/>
        <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>
      `)),
      'export.xml',
      {
        fromDate: '2026-04-01T00:00:00.000Z',
        toDate: '2026-04-30T23:59:59.999Z',
        metricTypes: ['steps'],
        chunkSize: 64,
      },
    );

    expect(result.summary.detectedRecordCount).toBe(2);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]?.value).toBe(3200);
  });

  it('filters metric types before saving samples', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml(`
        <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-04-20 07:00:00 +0000" endDate="2026-04-20 07:00:00 +0000" value="58"/>
      `)),
      'export.xml',
      { metricTypes: ['resting_heart_rate'], chunkSize: 51 },
    );

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]?.metricType).toBe('resting_heart_rate');
  });

  it('skips unsupported and invalid tags without crashing', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml(`
        <Record type="HKQuantityTypeIdentifierUnknown" unit="count" startDate="2026-04-20 10:00:00 +0000" value="1"/>
        <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 11:00:00 +0000" endDate="2026-04-20 11:05:00 +0000"/>
      `)),
      'export.xml',
      { chunkSize: 40 },
    );

    expect(result.samples).toEqual([]);
    expect(result.warnings.join(' ')).toContain('已跳过');
  });

  it('aggregates asleep sleep segments and ignores awake or in-bed segments', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml(`
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-27 23:30:00 +0000" endDate="2026-04-28 02:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 01:30:00 +0000" endDate="2026-04-28 03:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 03:00:00 +0000" endDate="2026-04-28 07:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-28 07:00:00 +0000" endDate="2026-04-28 07:15:00 +0000" value="HKCategoryValueSleepAnalysisAwake"/>
      `)),
      'export.xml',
      { metricTypes: ['sleep_duration'], chunkSize: 80 },
    );

    const sleep = result.samples.find((sample) => sample.metricType === 'sleep_duration');
    expect(sleep?.value).toBe(7.5);
    expect((sleep?.raw as { day?: string } | undefined)?.day).toBe('2026-04-28');
  });

  it('parses workouts as imported external activity', async () => {
    const result = await parseAppleHealthXmlStreaming(
      blobOf(makeXml(`
        <Workout workoutActivityType="HKWorkoutActivityTypeRunning" sourceName="Apple Watch" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" duration="35" durationUnit="min">
          <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" sum="320" unit="kcal"/>
          <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="2026-04-20 18:00:00 +0000" endDate="2026-04-20 18:35:00 +0000" sum="5" unit="km"/>
        </Workout>
      `)),
      'export.xml',
      { metricTypes: ['workout'], includeWorkouts: true, chunkSize: 90 },
    );

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]?.durationMin).toBe(35);
    expect(result.workouts[0]?.activeEnergyKcal).toBe(320);
    expect(result.workouts[0]?.distanceMeters).toBe(5000);
  });

  it('does not store complete XML text in raw data or batch data', async () => {
    const xml = makeXml(`<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:30:00 +0000" value="3200" xmlText="${'x'.repeat(2000)}"/>`);
    const result = await parseAppleHealthXmlStreaming(blobOf(xml), 'export.xml', { chunkSize: 60 });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('xmlText');
    expect(serialized).not.toContain(xml);
    expect(JSON.stringify(result.samples[0]?.raw || {}).length).toBeLessThan(1000);
  });
});
