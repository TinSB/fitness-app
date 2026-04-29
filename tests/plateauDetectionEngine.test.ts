import { describe, expect, it } from 'vitest';
import { detectExercisePlateau } from '../src/engines/plateauDetectionEngine';
import type {
  E1RMProfile,
  EffectiveVolumeSummary,
  LoadFeedback,
  PainPattern,
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
    setOverrides?: Partial<TrainingSetLog>[];
    dataFlag?: TrainingSession['dataFlag'];
    loadFeedback?: LoadFeedback[];
  } = {},
): TrainingSession => {
  const date = `2026-04-${String(index + 1).padStart(2, '0')}`;
  const baseSets = overrides.setOverrides || [{}, {}, {}];
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
    loadFeedback: overrides.loadFeedback || [],
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
        sets: baseSets.map((setOverrides, setIndex) =>
          workingSet(setIndex, {
            weight: overrides.weightKg ?? 80,
            actualWeightKg: overrides.weightKg ?? 80,
            reps: overrides.reps ?? 8,
            ...setOverrides,
          }),
        ),
      },
    ],
  };
};

const stableHistory = (count: number, overrides: Parameters<typeof session>[1] = {}) =>
  Array.from({ length: count }, (_, index) => session(index, overrides));

const flatE1rmProfile = (values: number[] = [100, 100.5, 100.2, 100.4, 100.3]): E1RMProfile => ({
  exerciseId: 'bench-press',
  current: {
    exerciseId: 'bench-press',
    e1rmKg: values[values.length - 1],
    formula: 'epley',
    confidence: 'medium',
    sourceSet: {
      sessionId: 'session-latest',
      date: '2026-04-10',
      weightKg: 80,
      reps: 8,
      rir: 2,
      techniqueQuality: 'good',
      painFlag: false,
    },
    notes: ['趋势参考'],
  },
  recentValues: values,
  method: 'median_recent',
});

const visibleText = (result: ReturnType<typeof detectExercisePlateau>) =>
  [
    result.title,
    result.summary,
    ...result.signals.flatMap((item) => [item.label, item.reason]),
    ...result.suggestedActions,
  ].join('\n');

describe('plateauDetectionEngine', () => {
  it('returns insufficient_data when records are sparse', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: [session(0)],
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.confidence).toBe('low');
    expect(result.title).toContain('数据不足');
    expect(result.summary).toContain('观察参考');
  });

  it('marks stable 4-session no-progress trend as possible plateau', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(4),
    });

    expect(result.status).toBe('possible_plateau');
    expect(result.title).toContain('进展放缓');
    expect(result.signals.some((item) => item.label.includes('进展放缓'))).toBe(true);
    expect(result.suggestedActions.join('\n')).toContain('继续观察');
  });

  it('marks repeated e1RM, weight and reps stagnation as plateau', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(7),
      e1rmProfile: flatE1rmProfile(),
    });

    expect(result.status).toBe('plateau');
    expect(result.title).toContain('进展停滞');
    expect(visibleText(result)).toContain('计划调整草案');
  });

  it('classifies frequent heavy feedback as load_too_aggressive', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(5),
      loadFeedback: {
        exerciseId: 'bench-press',
        total: 4,
        counts: { too_light: 0, good: 1, too_heavy: 3 },
        dominantFeedback: 'too_heavy',
        adjustment: { direction: 'decrease_load', dominantFeedback: 'too_heavy', reasons: ['测试'] },
      },
    });

    expect(result.status).toBe('load_too_aggressive');
    expect(result.title).toContain('推进过快');
    expect(visibleText(result)).toContain('重量偏重');
  });

  it('classifies repeated poor technique as technique_limited', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(4, {
        setOverrides: [
          { techniqueQuality: 'poor' },
          { techniqueQuality: 'poor' },
          { techniqueQuality: 'acceptable' },
        ],
      }),
    });

    expect(result.status).toBe('technique_limited');
    expect(result.title).toContain('动作质量');
    expect(result.suggestedActions.join('\n')).toContain('优先提高动作质量');
  });

  it('classifies pain flags and pain patterns as fatigue_limited', () => {
    const painPattern: PainPattern = {
      area: '肩',
      exerciseId: 'bench-press',
      frequency: 3,
      severityAvg: 4,
      lastOccurredAt: '2026-04-20',
      suggestedAction: 'substitute',
    };

    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(4, {
        setOverrides: [{ painFlag: true, painArea: '肩', painSeverity: 3 }, {}, {}],
      }),
      painPatterns: [painPattern],
    });

    expect(result.status).toBe('fatigue_limited');
    expect(result.title).toContain('疲劳');
    expect(visibleText(result)).toContain('不适');
  });

  it('classifies long-term low effective sets as volume_limited', () => {
    const effectiveSetSummary: Partial<EffectiveVolumeSummary> = {
      completedSets: 12,
      effectiveSets: 2,
      highConfidenceEffectiveSets: 0,
    };

    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(4, { reps: 10 }),
      effectiveSetSummary,
    });

    expect(result.status).toBe('volume_limited');
    expect(result.title).toContain('训练量不足');
    expect(visibleText(result)).toContain('有效训练量不足');
  });

  it('does not classify one no-progress session as plateau', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: [session(0), session(1)],
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.status).not.toBe('plateau');
    expect(result.status).not.toBe('possible_plateau');
  });

  it('ignores test and excluded sessions', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: [
        ...stableHistory(6, { dataFlag: 'test' }),
        ...stableHistory(6, { dataFlag: 'excluded' }),
      ],
    });

    expect(result.status).toBe('insufficient_data');
    expect(visibleText(result)).not.toMatch(/\btest|excluded\b/i);
  });

  it('keeps visible output Chinese and avoids raw enum leakage', () => {
    const result = detectExercisePlateau({
      exerciseId: 'bench-press',
      history: stableHistory(5),
      e1rmProfile: flatE1rmProfile(),
      loadFeedback: [{ exerciseId: 'bench-press', sessionId: 'session-1', date: '2026-04-01', feedback: 'too_heavy' }],
    });
    const text = visibleText(result);

    expect(text).not.toMatch(
      /\b(none|possible_plateau|plateau|fatigue_limited|technique_limited|volume_limited|load_too_aggressive|insufficient_data|too_heavy|too_light|good|info|warning|serious|undefined|null)\b/i,
    );
    expect(text).toMatch(/[进展记录动作质量训练量]/);
  });

  it('does not mutate history while analyzing plateau status', () => {
    const history = stableHistory(5);
    const before = JSON.stringify(history);

    detectExercisePlateau({
      exerciseId: 'bench-press',
      history,
      e1rmProfile: flatE1rmProfile(),
    });

    expect(JSON.stringify(history)).toBe(before);
  });
});
