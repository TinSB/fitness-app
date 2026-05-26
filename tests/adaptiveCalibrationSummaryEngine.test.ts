import { describe, expect, it } from 'vitest';
import { buildCalibrationSummary } from '../src/engines/adaptiveCalibrationSummaryEngine';
import type { AdaptiveCalibrationEntry, AdaptiveCalibrationState } from '../src/models/training-model';

const entry = (overrides: Partial<AdaptiveCalibrationEntry> & { exerciseId: string; loadBias: number }): AdaptiveCalibrationEntry => ({
  exerciseId: overrides.exerciseId,
  repBand: overrides.repBand ?? 'moderate',
  dayState: overrides.dayState ?? 'green',
  loadBias: overrides.loadBias,
  observationCount: overrides.observationCount ?? 3,
  recentSamples: overrides.recentSamples ?? [],
  reasonHints: overrides.reasonHints ?? [],
  lastUpdated: overrides.lastUpdated ?? '2026-05-20T10:00:00.000Z',
  frozenUntil: overrides.frozenUntil,
});

const state = (entries: AdaptiveCalibrationEntry[]): AdaptiveCalibrationState => ({
  version: 1,
  entries,
  recommendationLog: [],
  lastUpdated: '2026-05-26T10:00:00.000Z',
});

describe('adaptiveCalibrationSummaryEngine', () => {
  it('returns hasData=false when state is missing or empty', () => {
    expect(buildCalibrationSummary(undefined).hasData).toBe(false);
    expect(buildCalibrationSummary(state([])).hasData).toBe(false);
    expect(buildCalibrationSummary(undefined).headline).toContain('尚无');
  });

  it('classifies entries into increased / neutral / decreased buckets', () => {
    const summary = buildCalibrationSummary(state([
      entry({ exerciseId: 'bench-press', loadBias: 1.05 }),
      entry({ exerciseId: 'lat-pulldown', loadBias: 1.0 }),
      entry({ exerciseId: 'squat', loadBias: 0.94 }),
    ]));
    expect(summary.bucketCounts.increased).toBe(1);
    expect(summary.bucketCounts.neutral).toBe(1);
    expect(summary.bucketCounts.decreased).toBe(1);
    expect(summary.averageBias).toBeCloseTo((1.05 + 1.0 + 0.94) / 3, 2);
  });

  it('identifies largest increase and decrease', () => {
    const summary = buildCalibrationSummary(state([
      entry({ exerciseId: 'bench-press', loadBias: 1.04 }),
      entry({ exerciseId: 'incline-press', loadBias: 1.08 }),
      entry({ exerciseId: 'squat', loadBias: 0.93 }),
      entry({ exerciseId: 'deadlift', loadBias: 0.96 }),
    ]));
    expect(summary.largestIncrease?.exerciseId).toBe('incline-press');
    expect(summary.largestDecrease?.exerciseId).toBe('squat');
  });

  it('counts frozen entries when frozenUntil is in the future', () => {
    const now = '2026-05-26T10:00:00.000Z';
    const summary = buildCalibrationSummary(
      state([
        entry({ exerciseId: 'bench-press', loadBias: 1.06, frozenUntil: '2026-06-01T00:00:00.000Z' }),
        entry({ exerciseId: 'squat', loadBias: 0.95, frozenUntil: '2026-04-01T00:00:00.000Z' }),
      ]),
      now,
    );
    expect(summary.frozenEntries).toBe(1);
    expect(summary.activeEntries).toBe(1);
    expect(summary.recentlyFrozen?.exerciseId).toBe('bench-press');
  });

  it('builds a human readable headline reflecting the buckets', () => {
    const summary = buildCalibrationSummary(state([
      entry({ exerciseId: 'a', loadBias: 1.05 }),
      entry({ exerciseId: 'b', loadBias: 0.95 }),
    ]));
    expect(summary.headline).toContain('1 个动作自动小幅加重');
    expect(summary.headline).toContain('1 个动作自动小幅减重');
  });

  it('collects up to 5 unique reason hints', () => {
    const summary = buildCalibrationSummary(state([
      entry({ exerciseId: 'a', loadBias: 1.05, reasonHints: ['连续 3 次轻松完成'] }),
      entry({ exerciseId: 'b', loadBias: 0.95, reasonHints: ['连续 2 次未完成目标', '动作质量偏弱'] }),
      entry({ exerciseId: 'c', loadBias: 1.04, reasonHints: ['连续 3 次轻松完成'] }),
    ]));
    expect(summary.reasonHints).toEqual(['连续 3 次轻松完成', '连续 2 次未完成目标', '动作质量偏弱']);
  });
});
