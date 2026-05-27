import { describe, expect, it } from 'vitest';
import { buildRepRangeMigration } from '../src/engines/repRangeAutoMigrationEngine';
import { buildAutoDeloadTrigger } from '../src/engines/autoDeloadTriggerEngine';
import { buildMuscleFrequencyAdjustment } from '../src/engines/muscleFrequencyAutoAdjustEngine';
import { buildEquipmentFallback } from '../src/engines/equipmentFallbackEngine';
import type { TrainingSession, TrainingSetLog, MuscleGroup } from '../src/models/training-model';

const setLog = (overrides: Partial<TrainingSetLog>): TrainingSetLog => ({
  weight: 100,
  reps: 5,
  rir: 2,
  completionStatus: 'completed',
  ...overrides,
});

const session = (
  date: string,
  exerciseId: string,
  muscle: MuscleGroup,
  sets: TrainingSetLog[],
): TrainingSession =>
  ({
    id: `sess-${date}-${exerciseId}`,
    date,
    templateId: 'template-1',
    exercises: [
      {
        id: exerciseId,
        baseId: exerciseId,
        name: exerciseId,
        muscle,
        sets,
      },
    ],
  } as unknown as TrainingSession);

describe('repRangeAutoMigrationEngine (Feature #3)', () => {
  it('proposes migrating from 8-12 to 6-10 when growth stalls and reps hit top of range', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 12 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 80, reps: 12 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 80, reps: 12 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 80, reps: 12 })]),
    ];
    const out = buildRepRangeMigration({
      history,
      exerciseId: 'bench',
      currentRepMin: 8,
      currentRepMax: 12,
      asOfDate: '2026-04-29',
    });
    expect(out.shouldMigrate).toBe(true);
    expect(out.rationale).toBe('stall_detected');
    expect(out.recommendedRepMin).toBeLessThanOrEqual(8);
    expect(out.recommendedRepMax).toBeLessThanOrEqual(12);
  });

  it('does not migrate while the user is still progressing', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 10 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 82.5, reps: 10 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 85, reps: 10 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 87.5, reps: 10 })]),
    ];
    const out = buildRepRangeMigration({
      history,
      exerciseId: 'bench',
      currentRepMin: 8,
      currentRepMax: 12,
      asOfDate: '2026-04-29',
    });
    expect(out.shouldMigrate).toBe(false);
    expect(out.rationale).toBe('growth_within_limits');
  });

  it('does not migrate when the user has not been hitting the top of the range', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 9 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 80, reps: 9 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 80, reps: 9 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 80, reps: 9 })]),
    ];
    const out = buildRepRangeMigration({
      history,
      exerciseId: 'bench',
      currentRepMin: 8,
      currentRepMax: 12,
      asOfDate: '2026-04-29',
    });
    expect(out.rationale).toBe('top_of_range_not_hit');
  });
});

describe('autoDeloadTriggerEngine (Feature #19)', () => {
  it('triggers a deload when 4 weeks of PRs combine with high fatigue', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 5 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 82.5, reps: 5 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 85, reps: 5 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 87.5, reps: 5 })]),
    ];
    const out = buildAutoDeloadTrigger({
      history,
      fatigueScore0to100: 88,
      asOfDate: '2026-04-29',
    });
    expect(out.shouldProposeDeload).toBe(true);
    expect(out.rationale).toBe('streak_and_fatigue_triggered');
  });

  it('holds back when fatigue is below the threshold', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 5 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 82.5, reps: 5 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 85, reps: 5 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 87.5, reps: 5 })]),
    ];
    const out = buildAutoDeloadTrigger({
      history,
      fatigueScore0to100: 50,
      asOfDate: '2026-04-29',
    });
    expect(out.shouldProposeDeload).toBe(false);
    expect(out.rationale).toBe('fatigue_below_threshold');
  });

  it('holds back when the user has not been progressing every week', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', '胸', [setLog({ weight: 80, reps: 5 })]),
      session('2026-04-08', 'bench', '胸', [setLog({ weight: 80, reps: 5 })]),
      session('2026-04-15', 'bench', '胸', [setLog({ weight: 82.5, reps: 5 })]),
      session('2026-04-22', 'bench', '胸', [setLog({ weight: 82.5, reps: 5 })]),
    ];
    const out = buildAutoDeloadTrigger({
      history,
      fatigueScore0to100: 88,
      asOfDate: '2026-04-29',
    });
    expect(out.shouldProposeDeload).toBe(false);
    expect(out.rationale).toBe('pr_streak_short');
  });
});

describe('muscleFrequencyAutoAdjustEngine (Feature #22)', () => {
  it('proposes +1 frequency when weekly volume is consistently below the floor', () => {
    const weeks = ['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22'];
    const history = weeks.map((d) => session(d, 'curl', '手臂', [setLog({ weight: 10, reps: 12 })]));
    const out = buildMuscleFrequencyAdjustment({
      history,
      currentFrequencyByMuscle: { 手臂: 1 },
      asOfDate: '2026-04-29',
    });
    const arm = out.entries.find((e) => e.muscle === '手臂');
    expect(arm?.delta).toBe(1);
    expect(arm?.reason).toBe('volume_floor_breached');
  });

  it('proposes -1 frequency when weekly volume is consistently above the ceiling', () => {
    const weeks = ['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22'];
    // Each "week" has 8 sessions sharing the same calendar day so weekKeyOf
    // groups them — total 24 work sets / week, well above the 22-set ceiling.
    const history = weeks.flatMap((d) =>
      Array.from({ length: 8 }, (_, i) =>
        session(d, `bench-${d}-${i}`, '胸', [
          setLog({ weight: 80, reps: 8 }),
          setLog({ weight: 80, reps: 8 }),
          setLog({ weight: 80, reps: 8 }),
        ]),
      ),
    );
    const out = buildMuscleFrequencyAdjustment({
      history,
      currentFrequencyByMuscle: { 胸: 4 },
      asOfDate: '2026-04-29',
    });
    const chest = out.entries.find((e) => e.muscle === '胸');
    expect(chest?.delta).toBe(-1);
    expect(chest?.reason).toBe('volume_ceiling_breached');
  });
});

describe('equipmentFallbackEngine (Feature #25)', () => {
  it('ranks same equivalence chain first', () => {
    const out = buildEquipmentFallback({
      unavailable: {
        exerciseId: 'bench-press',
        primaryMuscles: ['胸'],
        movementPattern: '水平推',
        equivalenceChainId: 'horizontal-press',
        fatigueCost: 'high',
      },
      library: [
        {
          exerciseId: 'dumbbell-press',
          primaryMuscles: ['胸'],
          movementPattern: '水平推',
          equivalenceChainId: 'horizontal-press',
          fatigueCost: 'medium',
        },
        {
          exerciseId: 'cable-fly',
          primaryMuscles: ['胸'],
          movementPattern: '水平内收',
          fatigueCost: 'low',
        },
        {
          exerciseId: 'leg-curl',
          primaryMuscles: ['腿'],
          movementPattern: '屈膝',
          fatigueCost: 'low',
        },
      ],
    });
    expect(out.entries[0]?.exerciseId).toBe('dumbbell-press');
    expect(out.entries[0]?.reason).toBe('same_equivalence_chain');
    expect(out.entries.length).toBeLessThanOrEqual(3);
    expect(out.entries.find((e) => e.exerciseId === 'leg-curl')).toBeUndefined();
  });
});
