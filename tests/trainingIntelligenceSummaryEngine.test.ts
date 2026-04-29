import { describe, expect, it } from 'vitest';
import { buildTrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
import type {
  E1RMProfile,
  MuscleVolumeDashboardRow,
  TrainingSession,
  TrainingSetLog,
} from '../src/models/training-model';

const workingSet = (index: number, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: `set-${index}`,
  type: 'working',
  weight: 80,
  actualWeightKg: 80,
  reps: 8,
  rir: 2,
  done: true,
  techniqueQuality: 'good',
  painFlag: false,
  ...overrides,
});

const session = (
  index: number,
  overrides: {
    weightKg?: number;
    reps?: number;
    sets?: TrainingSetLog[];
    dataFlag?: TrainingSession['dataFlag'];
  } = {},
): TrainingSession => {
  const date = `2026-04-${String(index + 1).padStart(2, '0')}`;
  return {
    id: `session-${index}`,
    date,
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: `${date}T11:00:00.000Z`,
    templateId: 'push-a',
    templateName: '推 A',
    trainingMode: 'hybrid',
    completed: true,
    dataFlag: overrides.dataFlag || 'normal',
    exercises: [
      {
        id: 'bench-press',
        baseId: 'bench-press',
        canonicalExerciseId: 'bench-press',
        name: '卧推',
        muscle: '胸',
        primaryMuscles: ['胸'],
        kind: 'compound',
        repMin: 6,
        repMax: 10,
        rest: 120,
        startWeight: 60,
        sets:
          overrides.sets ||
          [0, 1, 2].map((setIndex) =>
            workingSet(setIndex, {
              weight: overrides.weightKg ?? 80,
              actualWeightKg: overrides.weightKg ?? 80,
              reps: overrides.reps ?? 8,
            }),
          ),
      },
    ],
  };
};

const stableHistory = (count: number) => Array.from({ length: count }, (_, index) => session(index));

const flatE1rmProfile = (): E1RMProfile => ({
  exerciseId: 'bench-press',
  current: {
    exerciseId: 'bench-press',
    e1rmKg: 100,
    formula: 'epley',
    confidence: 'medium',
    sourceSet: {
      sessionId: 'session-6',
      date: '2026-04-07',
      weightKg: 80,
      reps: 8,
      rir: 2,
      techniqueQuality: 'good',
      painFlag: false,
    },
    notes: ['趋势参考'],
  },
  recentValues: [100, 100.4, 100.2, 100.5, 100.3],
  method: 'median_recent',
});

const volumeRow = (overrides: Partial<MuscleVolumeDashboardRow> & { muscleId: string }): MuscleVolumeDashboardRow => ({
  muscleId: overrides.muscleId,
  muscleName: overrides.muscleName || overrides.muscleId,
  targetSets: overrides.targetSets ?? 10,
  completedSets: overrides.completedSets ?? 8,
  effectiveSets: overrides.effectiveSets ?? 7,
  highConfidenceEffectiveSets: overrides.highConfidenceEffectiveSets ?? 6,
  weightedEffectiveSets: overrides.weightedEffectiveSets ?? 8,
  remainingSets: overrides.remainingSets ?? Math.max(0, (overrides.targetSets ?? 10) - (overrides.weightedEffectiveSets ?? 8)),
  status: overrides.status || 'near_target',
  notes: overrides.notes || [],
});

const visibleText = (summary: ReturnType<typeof buildTrainingIntelligenceSummary>) =>
  [
    ...summary.keyInsights,
    ...summary.recommendedActions.flatMap((item) => [item.label, item.reason]),
    summary.sessionQuality?.title || '',
    summary.sessionQuality?.summary || '',
    summary.volumeAdaptation?.summary || '',
  ].join('\n');

describe('trainingIntelligenceSummaryEngine', () => {
  it('generates session quality when latest session exists', () => {
    const latestSession = session(0);
    const summary = buildTrainingIntelligenceSummary({
      latestSession,
      history: [latestSession],
      trainingLevel: 'intermediate',
    });

    expect(summary.sessionQuality).toBeDefined();
    expect(summary.sessionQuality?.title).toContain('本次训练质量');
    expect(summary.keyInsights.length).toBeGreaterThan(0);
  });

  it('adds a key insight when plateau is detected', () => {
    const history = stableHistory(7);
    const summary = buildTrainingIntelligenceSummary({
      latestSession: history[6],
      history,
      e1rmProfiles: [flatE1rmProfile()],
      trainingLevel: 'intermediate',
    });

    expect(summary.plateauResults?.some((item) => item.status === 'plateau')).toBe(true);
    expect(summary.keyInsights.some((item) => item.includes('进展停滞'))).toBe(true);
    expect(summary.recommendedActions.some((item) => item.actionType === 'review_exercise')).toBe(true);
  });

  it('adds a volume insight for an undertrained muscle', () => {
    const latestSession = session(0);
    const summary = buildTrainingIntelligenceSummary({
      latestSession,
      history: [latestSession],
      weeklyVolumeSummary: [
        volumeRow({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          weightedEffectiveSets: 6,
          remainingSets: 6,
          status: 'low',
        }),
      ],
      trainingLevel: 'intermediate',
    });

    expect(summary.volumeAdaptation?.muscles[0].decision).toBe('increase');
    expect(summary.keyInsights.some((item) => item.includes('背部') && item.includes('增加'))).toBe(true);
    expect(summary.recommendedActions.some((item) => item.actionType === 'create_adjustment_preview' && item.requiresConfirmation)).toBe(true);
  });

  it('returns low-noise guidance when there is no usable data', () => {
    const summary = buildTrainingIntelligenceSummary({});

    expect(summary.sessionQuality).toBeUndefined();
    expect(summary.recommendationConfidence).toEqual([]);
    expect(summary.plateauResults).toEqual([]);
    expect(summary.keyInsights).toEqual(['当前训练智能数据还在积累中，继续记录训练、余力（RIR）和动作质量后会更稳定。']);
    expect(summary.recommendedActions).toHaveLength(1);
    expect(summary.recommendedActions[0].actionType).toBe('keep_observing');
  });

  it('does not mutate input data while building the summary', () => {
    const latestSession = session(0);
    const history = [latestSession, session(1, { dataFlag: 'test' })];
    const weeklyVolumeSummary = [
      volumeRow({
        muscleId: '胸',
        muscleName: '胸部',
        targetSets: 10,
        weightedEffectiveSets: 10,
        status: 'on_target',
      }),
    ];
    const before = JSON.stringify({ latestSession, history, weeklyVolumeSummary });

    buildTrainingIntelligenceSummary({
      latestSession,
      history,
      weeklyVolumeSummary,
      trainingLevel: 'intermediate',
    });

    expect(JSON.stringify({ latestSession, history, weeklyVolumeSummary })).toBe(before);
  });

  it('keeps visible output Chinese and avoids raw enum leakage', () => {
    const history = stableHistory(7);
    const summary = buildTrainingIntelligenceSummary({
      latestSession: history[6],
      history,
      e1rmProfiles: [flatE1rmProfile()],
      weeklyVolumeSummary: [
        volumeRow({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          weightedEffectiveSets: 6,
          remainingSets: 6,
          status: 'low',
        }),
      ],
      trainingLevel: 'intermediate',
    });
    const text = visibleText(summary);

    expect(text).not.toMatch(
      /\b(review_session|review_exercise|review_volume|create_adjustment_preview|keep_observing|plateau|possible_plateau|increase|maintain|decrease|hold|low|medium|high|undefined|null|test|excluded)\b/i,
    );
    expect(text).toMatch(/[训练推荐进展调整记录]/);
    expect(summary.keyInsights.length).toBeLessThanOrEqual(4);
  });
});
