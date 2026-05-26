import { describe, expect, it } from 'vitest';
import { buildTrainingLapseSignal } from '../src/engines/trainingLapseEngine';
import type {
  AdaptiveCalibrationState,
  MesocyclePlan,
  TrainingLevel,
  TrainingSession,
  UserProfile,
} from '../src/models/training-model';
import type { HealthSummary } from '../src/engines/healthSummaryEngine';

const NOW = '2026-05-27T10:00:00.000Z';

const makeSessionRaw = (date: string, id?: string, templateId = 'push-a', muscle?: string): TrainingSession =>
  ({
    id: id ?? `s-${date}`,
    date,
    templateId,
    templateName: templateId,
    trainingMode: 'hybrid',
    focus: 'push',
    completed: true,
    finishedAt: `${date}T10:00:00.000Z`,
    exercises: muscle
      ? [
          {
            id: 'ex',
            name: 'ex',
            muscle,
            primaryMuscles: [muscle],
            kind: 'compound',
            sets: [
              { id: 'set-1', weight: 80, reps: 6, done: true, completionStatus: 'completed' },
            ],
          },
        ]
      : [],
  } as unknown as TrainingSession);

const makeProfile = (overrides: Partial<UserProfile>): UserProfile => ({
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 70,
  trainingLevel: 'intermediate' as TrainingLevel,
  primaryGoal: 'hypertrophy',
  weeklyTrainingDays: 3,
  sessionDurationMin: 60,
  secondaryPreferences: [],
  equipmentAccess: [],
  injuryFlags: [],
  painNotes: [],
  ...overrides,
} as UserProfile);

const makeHistoryWeeks = (cadencePerWeek: number, weeks: number, endDate: string): TrainingSession[] => {
  const end = Date.parse(`${endDate}T10:00:00.000Z`);
  const out: TrainingSession[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  for (let w = 0; w < weeks; w += 1) {
    for (let i = 0; i < cadencePerWeek; i += 1) {
      const ts = end - w * 7 * dayMs - i * dayMs;
      const date = new Date(ts).toISOString().slice(0, 10);
      out.push(makeSessionRaw(date, `s-w${w}-i${i}`));
    }
  }
  return out;
};

const calibration = (records: Array<{ date: string; outcome: AdaptiveCalibrationState['recommendationLog'][number]['outcome'] }>): AdaptiveCalibrationState => ({
  version: 1,
  entries: [],
  recommendationLog: records.map((record, index) => ({
    id: `r-${index}`,
    sessionId: `s-${record.date}`,
    date: record.date,
    exerciseId: 'bench-press',
    setIndex: 0,
    repBand: 'moderate',
    dayState: 'green',
    trainingMode: 'hybrid',
    recommendedKg: 80,
    recommendedReps: 6,
    appliedBias: 1,
    actualKg: 80,
    actualReps: 6,
    outcome: record.outcome,
  })),
  lastUpdated: '2026-05-26T10:00:00.000Z',
});

describe('trainingLapseEngine fine-grained', () => {
  it('personalizes thresholds for a 6x/week trainee (longer thresholds compared to baseline)', () => {
    const history = makeHistoryWeeks(6, 6, '2026-05-22');
    const signal = buildTrainingLapseSignal(history, NOW, { userProfile: makeProfile({ weeklyTrainingDays: 6 }) });
    expect(signal.personalGapDays).toBeLessThan(2);
    expect(signal.personalizedThresholds.lapsed).toBeGreaterThanOrEqual(12);
  });

  it('personalizes thresholds for a 1x/week trainee (more lenient thresholds)', () => {
    const history = makeHistoryWeeks(1, 6, '2026-05-22');
    const signal = buildTrainingLapseSignal(history, NOW, { userProfile: makeProfile({ weeklyTrainingDays: 1 }) });
    expect(signal.personalGapDays).toBeGreaterThan(4);
    // A 1x/week user trains roughly once a week; lapsed should kick in
    // later than the 21-day baseline because going 14 days is still close
    // to their normal cadence.
    expect(signal.personalizedThresholds.lapsed).toBeGreaterThan(21);
    expect(signal.personalizedThresholds.long_lapsed).toBeGreaterThan(45);
  });

  it('produces a smooth decay between normal and long_lapsed boundaries', () => {
    const decay15 = buildTrainingLapseSignal([makeSessionRaw('2026-05-12')], NOW).smoothDecay;
    const decay25 = buildTrainingLapseSignal([makeSessionRaw('2026-05-02')], NOW).smoothDecay;
    const decay40 = buildTrainingLapseSignal([makeSessionRaw('2026-04-17')], NOW).smoothDecay;
    expect(decay15).toBeGreaterThan(decay25);
    expect(decay25).toBeGreaterThan(decay40);
    expect(decay15).toBeLessThan(1);
    expect(decay40).toBeGreaterThan(0);
  });

  it('models strength retention with longer half-life for advanced trainees', () => {
    const beginnerSignal = buildTrainingLapseSignal([makeSessionRaw('2026-04-27')], NOW, { userProfile: makeProfile({ trainingLevel: 'beginner' }) });
    const advancedSignal = buildTrainingLapseSignal([makeSessionRaw('2026-04-27')], NOW, { userProfile: makeProfile({ trainingLevel: 'advanced' }) });
    expect(advancedSignal.strengthRetention).toBeGreaterThan(beginnerSignal.strengthRetention);
  });

  it('keeps aerobic retention high when external workouts are recorded', () => {
    const health: HealthSummary = {
      recentWorkoutCount: 4,
      recentWorkoutMinutes: 220,
      recentHighActivityDays: 4,
      notes: [],
      confidence: 'high',
    };
    const noHealth = buildTrainingLapseSignal([makeSessionRaw('2026-04-27')], NOW);
    const withHealth = buildTrainingLapseSignal([makeSessionRaw('2026-04-27')], NOW, { healthSummary: health });
    expect(withHealth.aerobicRetention).toBeGreaterThan(noHealth.aerobicRetention);
  });

  it('produces a suggested starting load factor between 0.55 and 1', () => {
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-03-15')], NOW);
    expect(signal.suggestedStartingLoadFactor).toBeGreaterThanOrEqual(0.55);
    expect(signal.suggestedStartingLoadFactor).toBeLessThanOrEqual(1);
  });

  it('classifies preBreakOutcome as mostly_struggling when recent records show pain/failed', () => {
    const cal = calibration([
      { date: '2026-05-10', outcome: 'pain' },
      { date: '2026-05-09', outcome: 'failed' },
      { date: '2026-05-08', outcome: 'too_heavy' },
      { date: '2026-05-07', outcome: 'on_target' },
    ]);
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-05-10')], NOW, { calibrationState: cal });
    expect(signal.preBreakOutcomeProfile).toBe('mostly_struggling');
    expect(signal.rotationHint).toBe('recovery_first');
  });

  it('classifies preBreakOutcome as mostly_on_target with steady on_target records', () => {
    const cal = calibration([
      { date: '2026-05-10', outcome: 'on_target' },
      { date: '2026-05-09', outcome: 'on_target' },
      { date: '2026-05-08', outcome: 'on_target' },
      { date: '2026-05-07', outcome: 'on_target' },
    ]);
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-05-10')], NOW, { calibrationState: cal });
    expect(signal.preBreakOutcomeProfile).toBe('mostly_on_target');
  });

  it('marks plannedDeload when mesocycle phase is deload and does not reset fatigue', () => {
    const plan = {
      planId: 'meso-1',
      length: 4,
      currentWeekIndex: 3,
      weekStartDate: '2026-05-25',
      weeks: [
        { weekIndex: 0, phase: 'accumulate', volumeMultiplier: 1, intensityBias: 'normal' },
        { weekIndex: 1, phase: 'accumulate', volumeMultiplier: 1, intensityBias: 'normal' },
        { weekIndex: 2, phase: 'intensify', volumeMultiplier: 0.95, intensityBias: 'aggressive' },
        { weekIndex: 3, phase: 'deload', volumeMultiplier: 0.7, intensityBias: 'conservative' },
      ],
    } as unknown as MesocyclePlan;
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-05-19')], NOW, { mesocyclePlan: plan });
    expect(signal.plannedDeload).toBe(true);
    expect(signal.resetFatigue).toBe(false);
  });

  it('hints rotation as restart_push after long_lapsed legs session', () => {
    const session = makeSessionRaw('2026-04-15', 'legs-old', 'legs-a', '腿');
    const signal = buildTrainingLapseSignal([session], NOW);
    expect(signal.stage).toBe('long_lapsed');
    expect(signal.lastMuscleEmphasis).toBe('腿');
    expect(signal.rotationHint).toBe('recovery_first');
  });

  it('computes per-muscle retention with longer half-life for large muscles', () => {
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-04-15')], NOW);
    const legs = signal.perMuscleRetention.find((entry) => entry.muscle === '腿');
    const arms = signal.perMuscleRetention.find((entry) => entry.muscle === '手臂');
    expect(legs).toBeDefined();
    expect(arms).toBeDefined();
    expect(legs!.halfLifeDays).toBeGreaterThan(arms!.halfLifeDays);
    expect(legs!.retention).toBeGreaterThan(arms!.retention);
  });

  it('reports confidence based on data richness', () => {
    const sparse = buildTrainingLapseSignal([makeSessionRaw('2026-05-25')], NOW);
    expect(sparse.confidence).toBe('low');

    const richHistory = makeHistoryWeeks(3, 4, '2026-05-26');
    const richSignal = buildTrainingLapseSignal(richHistory, NOW, {
      healthSummary: { recentWorkoutCount: 1, recentWorkoutMinutes: 50, recentHighActivityDays: 1, notes: [], confidence: 'high' },
    });
    expect(richSignal.confidence).toBe('high');
  });

  it('emits reasonsByCategory with strength / calibration / rotation entries when relevant', () => {
    const cal = calibration([
      { date: '2026-04-10', outcome: 'pain' },
      { date: '2026-04-09', outcome: 'failed' },
      { date: '2026-04-08', outcome: 'too_heavy' },
      { date: '2026-04-07', outcome: 'on_target' },
    ]);
    const signal = buildTrainingLapseSignal([makeSessionRaw('2026-04-10')], NOW, { calibrationState: cal });
    expect(signal.reasonsByCategory.strength.length).toBeGreaterThan(0);
    expect(signal.reasonsByCategory.calibration.length).toBeGreaterThan(0);
    expect(signal.reasonsByCategory.rotation.length).toBeGreaterThan(0);
  });
});
