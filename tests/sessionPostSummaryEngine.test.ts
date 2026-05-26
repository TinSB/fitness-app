import { describe, expect, it } from 'vitest';
import { buildSessionPostSummary } from '../src/engines/sessionPostSummaryEngine';
import { makeSession } from './fixtures';

const sessionA = makeSession({
  id: 's-current',
  date: '2026-05-26',
  templateId: 'push-a',
  exerciseId: 'bench-press',
  setSpecs: [
    { weight: 80, reps: 6, rir: 1 },
    { weight: 80, reps: 6, rir: 1 },
    { weight: 80, reps: 5, rir: 0 },
  ],
});

const sessionPrev = makeSession({
  id: 's-prev',
  date: '2026-05-23',
  templateId: 'push-a',
  exerciseId: 'bench-press',
  setSpecs: [
    { weight: 75, reps: 6, rir: 2 },
    { weight: 75, reps: 6, rir: 1 },
  ],
});

describe('sessionPostSummaryEngine', () => {
  it('computes total completed sets, volume, top set, and muscles touched', () => {
    const summary = buildSessionPostSummary(sessionA, []);
    expect(summary.totalCompletedSets).toBe(3);
    expect(summary.totalVolumeKg).toBe(Math.round(80 * 6 + 80 * 6 + 80 * 5));
    expect(summary.topSet?.exerciseId).toBe('bench-press');
    expect(summary.topSet?.weightKg).toBe(80);
    expect(summary.topSet?.reps).toBe(6);
    expect(summary.musclesTouched.length).toBeGreaterThan(0);
  });

  it('compares against latest completed same-template session in history', () => {
    const summary = buildSessionPostSummary(sessionA, [sessionPrev]);
    expect(summary.comparison?.previousSessionId).toBe('s-prev');
    expect(summary.comparison?.direction).toBe('up');
    expect(summary.comparison?.volumeDeltaKg).toBeGreaterThan(0);
    expect(summary.comparison?.topSetDeltaKg).toBe(5);
    expect(summary.highlights.some((line) => line.includes('多'))).toBe(true);
  });

  it('omits comparison when no prior same-template session exists', () => {
    const summary = buildSessionPostSummary(sessionA, []);
    expect(summary.comparison).toBeUndefined();
  });

  it('marks direction down when current volume is lower', () => {
    const lighter = makeSession({
      id: 's-light',
      date: '2026-05-26',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 5, rir: 2 }],
    });
    const summary = buildSessionPostSummary(lighter, [sessionPrev]);
    expect(summary.comparison?.direction).toBe('down');
    expect(summary.highlights.some((line) => line.includes('少'))).toBe(true);
  });

  it('handles sessions with no completed sets', () => {
    const empty = makeSession({
      id: 's-empty',
      date: '2026-05-26',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [],
    });
    const summary = buildSessionPostSummary(empty, []);
    expect(summary.totalCompletedSets).toBe(0);
    expect(summary.topSet).toBeUndefined();
    expect(summary.highlights[0]).toContain('没有完成组');
  });

  it('ignores test or excluded history sessions when picking a comparable session', () => {
    const flagged = { ...sessionPrev, id: 's-flagged', dataFlag: 'test' as const };
    const summary = buildSessionPostSummary(sessionA, [flagged]);
    expect(summary.comparison).toBeUndefined();
  });
});
