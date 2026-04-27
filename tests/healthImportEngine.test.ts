import { describe, expect, it } from 'vitest';
import { parseHealthImportFile } from '../src/engines/healthImportEngine';

describe('healthImportEngine', () => {
  it('parses structured JSON samples and workouts', () => {
    const result = parseHealthImportFile(
      JSON.stringify({
        samples: [
          { metricType: 'sleep_duration', startDate: '2026-04-20T22:00:00.000Z', value: 7.5, unit: 'h', source: 'apple_health_export' },
          { metricType: 'resting_heart_rate', startDate: '2026-04-21T07:00:00.000Z', value: 58, unit: 'bpm' },
        ],
        workouts: [
          { workoutType: '户外跑步', startDate: '2026-04-21T18:00:00.000Z', endDate: '2026-04-21T18:35:00.000Z', durationMin: 35, activeEnergyKcal: 320 },
        ],
      }),
      'health.json'
    );

    expect(result.samples).toHaveLength(2);
    expect(result.workouts).toHaveLength(1);
    expect(result.batch.sampleCount).toBe(2);
    expect(result.batch.workoutCount).toBe(1);
    expect(result.samples.every((sample) => sample.batchId === result.batch.id)).toBe(true);
    expect(result.workouts.every((workout) => workout.batchId === result.batch.id)).toBe(true);
  });

  it('parses CSV samples and keeps warnings for unknown columns', () => {
    const csv = [
      'metric,startDate,value,unit,source,unknownColumn',
      'steps,2026-04-21,9000,count,apple_health_export,extra',
      'hrv,2026-04-21T07:00:00.000Z,52,ms,apple_health_export,extra',
    ].join('\n');
    const result = parseHealthImportFile(csv, 'health.csv');

    expect(result.samples.map((sample) => sample.metricType)).toEqual(['steps', 'hrv']);
    expect(result.warnings.some((warning) => warning.includes('未识别 CSV 列'))).toBe(true);
  });

  it('routes XML input through Apple Health XML parser', () => {
    const result = parseHealthImportFile(
      `<?xml version="1.0"?><HealthData>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-21 07:00:00 +0000" endDate="2026-04-21 07:00:00 +0000" value="60"/>
      </HealthData>`,
      'export.xml'
    );

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]?.metricType).toBe('resting_heart_rate');
    expect(result.samples[0]?.source).toBe('apple_health_export');
    expect(result.samples[0]?.deviceSourceName).toBe('Apple Watch');
    expect(result.workouts).toEqual([]);
    expect(result.summary?.detectedRecordCount).toBe(1);
  });

  it('dedupes duplicate samples', () => {
    const csv = [
      'metric,startDate,value,unit,source',
      'steps,2026-04-21,9000,count,apple_health_export',
      'steps,2026-04-21,9000,count,apple_health_export',
    ].join('\n');
    const result = parseHealthImportFile(csv, 'health.csv');

    expect(result.samples).toHaveLength(1);
  });

  it('does not crash on invalid file content', () => {
    const result = parseHealthImportFile('{not-json', 'health.json');

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('解析失败'))).toBe(true);
  });

  it('returns a clear warning for non-Apple XML', () => {
    const result = parseHealthImportFile('<root></root>', 'export.xml');

    expect(result.samples).toEqual([]);
    expect(result.workouts).toEqual([]);
    expect(result.warnings.join(' ')).toContain('不是有效的 Apple Health');
  });
});
