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
    expect(decision.shouldShowWarmupSets).toBe(false);
    expect(decision.reason).toContain('同模式热身');
  });

  it('keeps warmup for high load exercises', () => {
    const decision = decideWarmupPolicy({
      exercise: exercise('heavy_press', 2, { startWeight: 90 }),
      exerciseIndex: 1,
      previousExercises: [exercise('bench')],
      completedWarmupPatterns: ['horizontal_push'],
      plannedWeight: 90,
    });
    expect(decision.policy).toBe('required');
    expect(decision.shouldShowWarmupSets).toBe(true);
  });

  it('returns none when no warmup sets are planned', () => {
    const decision = decideWarmupPolicy({ exercise: exercise('fly', 0), exerciseIndex: 1 });
    expect(decision.policy).toBe('none');
    expect(decision.shouldShowWarmupSets).toBe(false);
  });

  it('keeps the same horizontal push pattern for bench, incline press, and chest press', () => {
    const decisions = ['bench_press', 'incline_db_press', 'machine_chest_press'].map((id, index) =>
      decideWarmupPolicy({ exercise: makeExercise(id, 2, 0, 2), exerciseIndex: index })
    );
    expect(decisions.map((item) => item.movementPattern)).toEqual(['horizontal_push', 'horizontal_push', 'horizontal_push']);
  });
});
