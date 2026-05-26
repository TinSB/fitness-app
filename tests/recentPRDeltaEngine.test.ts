import { describe, expect, it } from 'vitest';
import { computeRecentPRDeltas } from '../src/engines/recentPRDeltaEngine';
import { makeSession } from './fixtures';
import type { TrainingSession } from '../src/models/training-model';

const NOW = '2026-05-27T10:00:00.000Z';

const session = (id: string, date: string, exerciseId: string, weight: number, reps: number): TrainingSession =>
  makeSession({ id, date, templateId: 'push-a', exerciseId, setSpecs: [{ weight, reps, rir: 1 }] });

describe('recentPRDeltaEngine', () => {
  it('returns empty when history has no recent sessions', () => {
    const history = [session('s-old', '2026-04-01', 'bench-press', 70, 5)];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW });
    expect(result).toEqual([]);
  });

  it('marks first-time exercise as direction=new', () => {
    const history = [session('s1', '2026-05-25', 'bench-press', 80, 6)];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('new');
    expect(result[0].deltaKg).toBeUndefined();
  });

  it('computes positive delta when current best exceeds previous', () => {
    const history = [
      session('s-recent', '2026-05-25', 'bench-press', 82.5, 6),
      session('s-prev', '2026-04-01', 'bench-press', 80, 6),
    ];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW });
    expect(result[0].direction).toBe('up');
    expect(result[0].deltaKg).toBe(2.5);
    expect(result[0].deltaPercent).toBeCloseTo(3.1, 1);
  });

  it('marks flat direction when current matches previous best', () => {
    const history = [
      session('s-recent', '2026-05-25', 'bench-press', 80, 6),
      session('s-prev', '2026-04-01', 'bench-press', 80, 6),
    ];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW });
    expect(result[0].direction).toBe('flat');
    expect(result[0].deltaKg).toBe(0);
  });

  it('marks down direction when current is lower than previous', () => {
    const history = [
      session('s-recent', '2026-05-25', 'bench-press', 75, 6),
      session('s-prev', '2026-04-01', 'bench-press', 80, 6),
    ];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW });
    expect(result[0].direction).toBe('down');
    expect(result[0].deltaKg).toBe(-5);
  });

  it('respects the limit parameter and orders by direction then delta', () => {
    const history = [
      session('s1', '2026-05-25', 'bench-press', 82, 6),
      session('s1-old', '2026-04-01', 'bench-press', 80, 6),
      session('s2', '2026-05-26', 'incline-db-press', 78, 6),
      session('s2-old', '2026-04-01', 'incline-db-press', 76, 6),
      session('s3', '2026-05-26', 'triceps-pushdown', 50, 10),
    ];
    const result = computeRecentPRDeltas(history, { windowDays: 14, nowIso: NOW, limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].direction).toBe('new');
  });
});
