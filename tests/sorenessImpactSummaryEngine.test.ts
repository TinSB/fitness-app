import { describe, expect, it } from 'vitest';
import { buildSorenessImpactSummary } from '../src/engines/sorenessImpactSummaryEngine';
import { getTemplate, makeStatus } from './fixtures';

describe('sorenessImpactSummaryEngine', () => {
  it('returns no impact when status reports 无 soreness', () => {
    const summary = buildSorenessImpactSummary(makeStatus({ soreness: ['无'] }), getTemplate('push-a'));
    expect(summary.hasSoreness).toBe(false);
    expect(summary.impactedExercises).toEqual([]);
  });

  it('flags chest soreness against push-a exercises', () => {
    const summary = buildSorenessImpactSummary(makeStatus({ soreness: ['胸'] }), getTemplate('push-a'));
    expect(summary.hasSoreness).toBe(true);
    expect(summary.sorenessAreas).toEqual(['胸']);
    expect(summary.impactedExercises.length).toBeGreaterThan(0);
    expect(summary.impactedExercises.every((entry) => entry.muscle === '胸')).toBe(true);
  });

  it('selects progress_lock for compound, reduce_sets for isolation/machine', () => {
    const summary = buildSorenessImpactSummary(makeStatus({ soreness: ['胸'] }), getTemplate('push-a'));
    const benchPress = summary.impactedExercises.find((entry) => entry.exerciseId === 'bench-press');
    const cableFly = summary.impactedExercises.find((entry) => entry.exerciseId === 'cable-fly');
    const machinePress = summary.impactedExercises.find((entry) => entry.exerciseId === 'machine-chest-press');
    expect(benchPress?.action).toBe('progress_lock');
    expect(cableFly?.action).toBe('reduce_sets');
    expect(machinePress?.action).toBe('reduce_sets');
  });

  it('handles soreness that does not match template muscles', () => {
    const summary = buildSorenessImpactSummary(makeStatus({ soreness: ['腿'] }), getTemplate('push-a'));
    expect(summary.hasSoreness).toBe(true);
    expect(summary.impactedExercises).toEqual([]);
    expect(summary.headline).toContain('没有命中');
  });

  it('returns sensible defaults for missing inputs', () => {
    const summary = buildSorenessImpactSummary(undefined, null);
    expect(summary.hasSoreness).toBe(false);
    expect(summary.impactedExercises).toEqual([]);
  });
});
