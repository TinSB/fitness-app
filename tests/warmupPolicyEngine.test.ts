import { describe, expect, it } from 'vitest';
import { decideWarmupPolicy } from '../src/engines/warmupPolicyEngine';
import type { ExercisePrescription } from '../src/models/training-model';
import { makeExercise } from './focusModeFixtures';

const exercise = (id: string, warmups = 2, patch: Partial<ExercisePrescription> = {}) =>
  ({
    ...makeExercise(id, 2, 0, warmups),
    movementPattern: 'horizontal_push',
    kind: 'compound',
    ...patch,
  }) as ExercisePrescription;

describe('warmup policy engine', () => {
  it('requires warmup for first main compound exercise', () => {
    const decision = decideWarmupPolicy({ exercise: exercise('bench'), exerciseIndex: 0 });
    expect(decision.policy).toBe('required');
    expect(decision.warmupDecision).toBe('full_warmup');
    expect(decision.shouldShowWarmupSets).toBe(true);
  });

  it('skips same movement pattern after warmup is completed and includes a reason', () => {
    const decision = decideWarmupPolicy({
      exercise: exercise('incline_db_press'),
      exerciseIndex: 1,
      previousExercises: [exercise('bench')],
      completedWarmupPatterns: ['horizontal_push'],
    });
    expect(decision.policy).toBe('skipped_by_policy');
    expect(decision.warmupDecision).toBe('no_warmup');
    expect(decision.shouldShowWarmupSets).toBe(false);
    expect(decision.reason).toContain('同模式热身');
  });

  it('keeps a feeder set instead of repeating full warmup for high load exercises already covered', () => {
    const decision = decideWarmupPolicy({
      exercise: exercise('heavy_press', 2, { startWeight: 90 }),
      exerciseIndex: 1,
      previousExercises: [exercise('bench')],
      completedWarmupPatterns: ['horizontal_push'],
      plannedWeight: 90,
    });
    expect(decision.policy).toBe('required');
    expect(decision.warmupDecision).toBe('feeder_set');
    expect(decision.shouldShowWarmupSets).toBe(true);
  });

  it('returns none when no warmup sets are planned', () => {
    const decision = decideWarmupPolicy({ exercise: exercise('fly', 0), exerciseIndex: 1 });
    expect(decision.policy).toBe('none');
    expect(decision.warmupDecision).toBe('no_warmup');
    expect(decision.shouldShowWarmupSets).toBe(false);
  });

  it('does not require warmup for small isolation exercises by default', () => {
    const triceps = exercise('triceps_pushdown', 2, {
      name: '三头下压',
      kind: 'isolation',
      orderPriority: 6,
      startWeight: 25,
    });
    const decision = decideWarmupPolicy({ exercise: triceps, exerciseIndex: 4, previousExercises: [exercise('bench')] });
    expect(decision.policy).not.toBe('required');
    expect(decision.warmupDecision).toBe('no_warmup');
    expect(decision.shouldShowWarmupSets).toBe(false);
    expect(decision.reason).toContain('孤立动作');
  });

  it('does not require warmup for lateral raises by default', () => {
    const lateralRaise = exercise('lateral_raise', 2, {
      name: '侧平举',
      kind: 'isolation',
      orderPriority: 6,
      startWeight: 8,
    });
    const decision = decideWarmupPolicy({ exercise: lateralRaise, exerciseIndex: 5 });
    expect(decision.policy).not.toBe('required');
    expect(decision.warmupDecision).toBe('no_warmup');
    expect(decision.shouldShowWarmupSets).toBe(false);
  });

  it('requires warmup only when isolation exercise is manually set to always', () => {
    const triceps = exercise('triceps_pushdown', 2, {
      name: '三头下压',
      kind: 'isolation',
      orderPriority: 6,
      warmupPreference: 'always',
    });
    const decision = decideWarmupPolicy({ exercise: triceps, exerciseIndex: 4 });
    expect(decision.policy).toBe('required');
    expect(decision.warmupDecision).toBe('full_warmup');
    expect(decision.shouldShowWarmupSets).toBe(true);
  });

  it('keeps the same horizontal push pattern for bench, incline press, and chest press', () => {
    const decisions = ['bench_press', 'incline_db_press', 'machine_chest_press'].map((id, index) =>
      decideWarmupPolicy({ exercise: makeExercise(id, 2, 0, 2), exerciseIndex: index })
    );
    expect(decisions.map((item) => item.movementPattern)).toEqual(['horizontal_push', 'horizontal_push', 'horizontal_push']);
  });
});
