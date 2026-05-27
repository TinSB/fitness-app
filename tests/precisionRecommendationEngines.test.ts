import { describe, expect, it } from 'vitest';
import { buildSetWeightFineTune } from '../src/engines/setWeightFineTuneEngine';
import { buildSetByRirAdjustment } from '../src/engines/setByRirAdjustmentEngine';
import { buildRirCalibration } from '../src/engines/rirCalibrationEngine';
import { buildExerciseTypeBucket } from '../src/engines/exerciseTypeBucketEngine';
import { buildExerciseEfficiency } from '../src/engines/exerciseEfficiencyEngine';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';

const setLog = (overrides: Partial<TrainingSetLog>): TrainingSetLog => ({
  weight: 100,
  reps: 5,
  rir: 2,
  completionStatus: 'completed',
  ...overrides,
});

const session = (date: string, exerciseId: string, sets: TrainingSetLog[]): TrainingSession =>
  ({
    id: `sess-${date}-${exerciseId}`,
    date,
    templateId: 'template-1',
    exercises: [
      {
        id: exerciseId,
        baseId: exerciseId,
        name: exerciseId,
        sets,
      },
    ],
  } as unknown as TrainingSession);

describe('setWeightFineTuneEngine (Feature #1)', () => {
  it('falls back to insufficient_history when fewer than 3 work sets are available', () => {
    const result = buildSetWeightFineTune({
      history: [],
      exerciseId: 'bench',
      targetReps: 6,
      repMin: 5,
      repMax: 8,
    });
    expect(result.basis.fallbackReason).toBe('insufficient_history');
    expect(result.suggestedWeightKg).toBe(0);
  });

  it('projects forward on a clean upward trend and rounds to 2.5 kg', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', [setLog({ weight: 80, reps: 6, rir: 2 })]),
      session('2026-04-08', 'bench', [setLog({ weight: 82.5, reps: 6, rir: 2 })]),
      session('2026-04-15', 'bench', [setLog({ weight: 85, reps: 6, rir: 2 })]),
      session('2026-04-22', 'bench', [setLog({ weight: 87.5, reps: 6, rir: 2 })]),
    ];
    const result = buildSetWeightFineTune({
      history,
      exerciseId: 'bench',
      targetReps: 6,
      repMin: 5,
      repMax: 8,
      asOfDate: '2026-04-29',
    });
    expect(result.basis.samplesUsed).toBeGreaterThanOrEqual(3);
    expect(result.basis.weeklySlopeKg).toBeGreaterThan(0);
    expect(result.suggestedWeightKg % 2.5).toBe(0);
    expect(result.suggestedWeightKg).toBeGreaterThanOrEqual(80);
  });

  it('caps weekly growth so a single outlier session does not balloon the recommendation', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'bench', [setLog({ weight: 80, reps: 6, rir: 2 })]),
      session('2026-04-08', 'bench', [setLog({ weight: 81, reps: 6, rir: 2 })]),
      session('2026-04-15', 'bench', [setLog({ weight: 82, reps: 6, rir: 2 })]),
      session('2026-04-22', 'bench', [setLog({ weight: 150, reps: 6, rir: 0 })]),
    ];
    const result = buildSetWeightFineTune({
      history,
      exerciseId: 'bench',
      targetReps: 6,
      repMin: 5,
      repMax: 8,
      asOfDate: '2026-04-29',
    });
    expect(result.suggestedWeightKg).toBeLessThan(100);
  });
});

describe('setByRirAdjustmentEngine (Feature #2)', () => {
  it('returns hold when actual RIR is inside the target window', () => {
    const out = buildSetByRirAdjustment({
      completedWeightKg: 100,
      completedReps: 6,
      actualRir: 2,
      targetRirMin: 1,
      targetRirMax: 3,
    });
    expect(out.direction).toBe('hold');
    expect(out.deltaKg).toBe(0);
  });

  it('decreases weight when actual RIR is below the target window', () => {
    const out = buildSetByRirAdjustment({
      completedWeightKg: 100,
      completedReps: 5,
      actualRir: 0,
      targetRirMin: 2,
      targetRirMax: 3,
    });
    expect(out.direction).toBe('decrease');
    expect(out.deltaKg).toBeLessThan(0);
    expect(out.nextSuggestedWeightKg).toBeLessThan(100);
  });

  it('increases weight when actual RIR is above the target window', () => {
    const out = buildSetByRirAdjustment({
      completedWeightKg: 100,
      completedReps: 8,
      actualRir: 4,
      targetRirMin: 1,
      targetRirMax: 2,
    });
    expect(out.direction).toBe('increase');
    expect(out.deltaKg).toBeGreaterThan(0);
  });

  it('skips adjustment when actualRir is missing', () => {
    const out = buildSetByRirAdjustment({
      completedWeightKg: 100,
      completedReps: 5,
      actualRir: null,
      targetRirMin: 1,
      targetRirMax: 3,
    });
    expect(out.reason).toBe('missing_actual_rir');
    expect(out.deltaKg).toBe(0);
  });
});

describe('rirCalibrationEngine (Feature #4)', () => {
  it('returns zero bias when there are not enough to-failure samples', () => {
    const out = buildRirCalibration({ history: [] });
    expect(out.userRirBias).toBe(0);
    expect(out.reason).toBe('insufficient_samples');
  });

  it('detects a positive bias when the user over-reports RIR=0', () => {
    const history: TrainingSession[] = [];
    for (let week = 0; week < 6; week += 1) {
      const date = `2026-${String(4 + Math.floor(week / 4)).padStart(2, '0')}-${String((week * 7) % 28 + 1).padStart(2, '0')}`;
      history.push(
        session(date, 'bench', [
          setLog({ weight: 80, reps: 8, rir: 3 }),
          setLog({ weight: 80, reps: 7, rir: 2 }),
          setLog({ weight: 80, reps: 4, rir: 0 }),
        ]),
      );
    }
    const out = buildRirCalibration({ history, asOfDate: '2026-06-01' });
    expect(out.sampleSize).toBeGreaterThanOrEqual(4);
    expect(out.userRirBias).toBeGreaterThan(0);
  });
});

describe('exerciseTypeBucketEngine (Feature #5)', () => {
  it('puts compound lifts into a 1–3 RIR window by default', () => {
    const out = buildExerciseTypeBucket({ id: 'squat', kind: 'compound', muscle: '腿' });
    expect(out.bucket).toBe('compound');
    expect(out.recommendedRirMin).toBe(1);
    expect(out.recommendedRirMax).toBe(3);
  });

  it('opens the window for high-skill compounds to 2–3 RIR', () => {
    const out = buildExerciseTypeBucket({
      id: 'snatch',
      kind: 'compound',
      muscle: '肩',
      skillDemand: 'high',
    });
    expect(out.rationale).toBe('compound_high_skill');
  });

  it('drops isolation lifts to a tighter 0–2 RIR window', () => {
    const out = buildExerciseTypeBucket({ id: 'curl', kind: 'isolation', muscle: '手臂' });
    expect(out.bucket).toBe('isolation');
    expect(out.recommendedRirMax).toBeLessThanOrEqual(2);
  });

  it('escalates isolation lifts with high fatigue cost back to a safer window', () => {
    const out = buildExerciseTypeBucket({
      id: 'rdl',
      kind: 'isolation',
      muscle: '腿',
      fatigueCost: 'high',
    });
    expect(out.rationale).toBe('isolation_high_fatigue');
    expect(out.recommendedRirMin).toBe(2);
  });
});

describe('exerciseEfficiencyEngine (Feature #26)', () => {
  it('ranks exercises by e1RM gain per tonne of tonnage', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'high-eff', [setLog({ weight: 60, reps: 8 })]),
      session('2026-04-08', 'high-eff', [setLog({ weight: 70, reps: 8 })]),
      session('2026-04-15', 'high-eff', [setLog({ weight: 80, reps: 8 })]),
      session('2026-04-01', 'low-eff', [setLog({ weight: 40, reps: 12 })]),
      session('2026-04-08', 'low-eff', [setLog({ weight: 40, reps: 12 })]),
      session('2026-04-15', 'low-eff', [setLog({ weight: 40, reps: 12 })]),
    ];
    const out = buildExerciseEfficiency({ history, asOfDate: '2026-04-22' });
    expect(out.entries.length).toBe(2);
    const high = out.entries.find((e) => e.exerciseId === 'high-eff');
    const low = out.entries.find((e) => e.exerciseId === 'low-eff');
    expect(high?.efficiencyScore).toBeGreaterThan(low?.efficiencyScore ?? 0);
    expect(high?.ranking === 'high' || high?.ranking === 'normal').toBe(true);
  });

  it('skips exercises with fewer than 3 sessions', () => {
    const history: TrainingSession[] = [
      session('2026-04-01', 'rare', [setLog({ weight: 50, reps: 5 })]),
      session('2026-04-08', 'rare', [setLog({ weight: 60, reps: 5 })]),
    ];
    const out = buildExerciseEfficiency({ history, asOfDate: '2026-04-15' });
    expect(out.entries).toEqual([]);
  });
});
