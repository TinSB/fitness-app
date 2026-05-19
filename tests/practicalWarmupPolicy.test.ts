import { describe, expect, it } from 'vitest';
import { buildPracticalWarmupPolicy } from '../src/engines/practicalWarmupPolicy';
import { buildWarmupSets } from '../src/engines/progressionRulesEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';

const lbToKg = (lb: number) => lb * 0.45359237;

describe('practical warmup policy', () => {
  it('caps standard barbell warmups at three sets and avoids default x2 or x1 reps', () => {
    const warmups = buildWarmupSets(lbToKg(225), {
      id: 'squat',
      name: 'Squat',
      kind: 'compound',
      rest: 180,
      repMin: 5,
      repMax: 8,
      startWeight: lbToKg(225),
      sets: 3,
    });

    expect(warmups.length).toBeGreaterThan(0);
    expect(warmups.length).toBeLessThanOrEqual(3);
    expect(warmups.map((set) => set.reps)).not.toContain(2);
    expect(warmups.map((set) => set.reps)).not.toContain(1);
  });

  it('keeps machine and dumbbell warmups shorter than heavy barbell compounds', () => {
    const heavyBarbell = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(225),
      exercise: { id: 'squat', name: 'Squat', kind: 'compound', fatigueCost: 'high' },
    }).warmupSets;
    const machine = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(180),
      exercise: { id: 'leg-press', name: 'Leg Press', kind: 'machine' },
    }).warmupSets;
    const dumbbell = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(80),
      exercise: { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', kind: 'compound' },
    }).warmupSets;

    expect(heavyBarbell.length).toBeGreaterThan(machine.length);
    expect(heavyBarbell.length).toBeGreaterThan(dumbbell.length);
    expect(machine.length).toBeLessThanOrEqual(1);
    expect(dumbbell.length).toBeLessThanOrEqual(1);
  });

  it('allows low-rep warmups only for explicit PR test or very-heavy intent', () => {
    const normal = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(315),
      exercise: { id: 'deadlift', name: 'Deadlift', kind: 'compound', fatigueCost: 'high' },
    });
    const prTest = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(315),
      exercise: { id: 'deadlift', name: 'Deadlift', kind: 'compound', fatigueCost: 'high' },
      intent: 'pr_test',
    });

    expect(normal.allowsLowRepWarmups).toBe(false);
    expect(normal.warmupSets.map((set) => set.reps)).not.toContain(2);
    expect(normal.warmupSets.map((set) => set.reps)).not.toContain(1);
    expect(prTest.allowsLowRepWarmups).toBe(true);
    expect(prTest.warmupSets.some((set) => set.reps <= 2)).toBe(true);
  });

  it('does not create formal warmups for correction or mobility tasks', () => {
    expect(
      buildPracticalWarmupPolicy({
        workWeightKg: 30,
        exercise: { id: 'mobility-hip', name: 'Mobility hip opener', kind: 'isolation' },
      }).warmupSets,
    ).toEqual([]);
    expect(
      buildPracticalWarmupPolicy({
        workWeightKg: 30,
        exercise: { id: 'correction-shoulder', name: 'Shoulder correction', kind: 'isolation' },
      }).warmupSets,
    ).toEqual([]);
  });

  it('resolves warmup loads through equipment-aware feasible loads before they become actionable', () => {
    const warmups = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(135),
      exercise: { id: 'bench-press', name: 'Bench Press', kind: 'compound' },
    }).warmupSets;

    expect(warmups.length).toBeGreaterThan(0);
    expect(convertKgToDisplayWeight(warmups[0].weight, 'lb')).toBe(45);
    expect(warmups.every((set) => set.weight < lbToKg(135))).toBe(true);
  });

  it('keeps generated warmup output marked as future-session policy only', () => {
    const result = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(225),
      exercise: { id: 'squat', name: 'Squat', kind: 'compound', fatigueCost: 'high' },
    });

    expect(result.intent).toBe('normal');
    expect(result.usesEquipmentAwareFeasibleLoads).toBe(true);
    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.persistenceChanged).toBe(false);
  });
});
