import { describe, expect, it } from 'vitest';
import { buildRecommendationConfidence } from '../src/engines/recommendationConfidenceEngine';
import type { E1RMProfile, LoadFeedback, PainPattern, TrainingSession, TrainingSetLog } from '../src/models/training-model';

const set = (index: number, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
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

const session = (index: number, overrides: {
  setOverrides?: Partial<TrainingSetLog>[];
  editedAt?: string;
  replacement?: boolean;
  dataFlag?: TrainingSession['dataFlag'];
  loadFeedback?: LoadFeedback[];
} = {}): TrainingSession => ({
  id: `session-${index}`,
  date: `2026-04-${String(index + 1).padStart(2, '0')}`,
  startedAt: `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
  finishedAt: `2026-04-${String(index + 1).padStart(2, '0')}T11:00:00.000Z`,
  templateId: 'push-a',
  templateName: '推 A',
  trainingMode: 'hybrid',
  completed: true,
  dataFlag: overrides.dataFlag || 'normal',
  editedAt: overrides.editedAt,
  editHistory: overrides.editedAt ? [{ editedAt: overrides.editedAt, fields: ['sets'] }] : [],
  loadFeedback: overrides.loadFeedback,
  exercises: [
    {
      id: overrides.replacement ? 'dumbbell-bench-press' : 'bench-press',
      baseId: 'bench-press',
      canonicalExerciseId: 'bench-press',
      originalExerciseId: overrides.replacement ? 'bench-press' : undefined,
      actualExerciseId: overrides.replacement ? 'dumbbell-bench-press' : undefined,
      replacementExerciseId: overrides.replacement ? 'dumbbell-bench-press' : undefined,
      name: overrides.replacement ? '哑铃卧推' : '卧推',
      muscle: '胸',
      primaryMuscles: ['胸'],
      kind: 'compound',
      repMin: 6,
      repMax: 10,
      rest: 120,
      startWeight: 60,
      sets: (overrides.setOverrides || [{}, {}, {}]).map((item, setIndex) => set(setIndex, item)),
    },
  ],
});

const highE1rmProfile = (confidence: 'low' | 'medium' | 'high' = 'high'): E1RMProfile => ({
  exerciseId: 'bench-press',
  current: {
    exerciseId: 'bench-press',
    e1rmKg: 100,
    formula: 'epley',
    confidence,
    sourceSet: {
      sessionId: 'session-1',
      date: '2026-04-01',
      weightKg: 80,
      reps: 8,
      rir: 2,
      techniqueQuality: confidence === 'low' ? 'acceptable' : 'good',
      painFlag: false,
    },
    notes: ['稳定记录'],
  },
  recentValues: [98, 100, 101],
  method: 'median_recent',
});

const stableHistory = () => Array.from({ length: 6 }, (_, index) => session(index));

const visibleText = (result: ReturnType<typeof buildRecommendationConfidence>) =>
  [
    result.title,
    result.summary,
    ...result.reasons.flatMap((item) => [item.label, item.reason]),
    ...result.missingData,
  ].join('\n');

describe('recommendationConfidenceEngine', () => {
  it('returns low confidence for 0-1 relevant records', () => {
    const empty = buildRecommendationConfidence({ exerciseId: 'bench-press', history: [] });
    const one = buildRecommendationConfidence({ exerciseId: 'bench-press', history: [session(0)] });

    expect(empty.level).toBe('low');
    expect(one.level).toBe('low');
    expect(one.summary).toContain('保守参考');
    expect(one.missingData.join('\n')).toContain('同动作');
  });

  it('returns high confidence for stable recent records', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: stableHistory(),
      e1rmProfile: highE1rmProfile('high'),
      effectiveSetSummary: {
        completedSets: 18,
        effectiveSets: 18,
        highConfidenceEffectiveSets: 16,
      },
      loadFeedback: {
        exerciseId: 'bench-press',
        total: 4,
        counts: { too_light: 0, good: 4, too_heavy: 0 },
        dominantFeedback: 'good',
        adjustment: { direction: 'normal', dominantFeedback: 'good', reasons: ['稳定'] },
      },
      trainingLevel: 'intermediate',
    });

    expect(result.level).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(78);
    expect(result.title).toBe('推荐可信度：高');
    expect(result.reasons.some((item) => item.label.includes('近期记录稳定'))).toBe(true);
    expect(result.reasons.some((item) => item.label.includes('余力记录完整'))).toBe(true);
  });

  it('lowers confidence when a pain pattern is obvious', () => {
    const painPattern: PainPattern = {
      area: '肩',
      exerciseId: 'bench-press',
      frequency: 4,
      severityAvg: 4,
      lastOccurredAt: '2026-04-25',
      suggestedAction: 'substitute',
    };

    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: stableHistory(),
      e1rmProfile: highE1rmProfile('high'),
      effectiveSetSummary: { completedSets: 18, effectiveSets: 18, highConfidenceEffectiveSets: 16 },
      painPatterns: [painPattern],
    });

    expect(result.level).not.toBe('high');
    expect(result.reasons.some((item) => item.label.includes('不适'))).toBe(true);
    expect(visibleText(result)).toContain('保守');
  });

  it('lowers confidence for poor technique', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: [
        session(0, { setOverrides: [{ techniqueQuality: 'poor' }, { techniqueQuality: 'poor' }, {}] }),
        session(1, { setOverrides: [{ techniqueQuality: 'poor' }, {}, {}] }),
        session(2, { setOverrides: [{ techniqueQuality: 'poor' }, {}, {}] }),
      ],
      e1rmProfile: highE1rmProfile('medium'),
    });

    expect(result.level).not.toBe('high');
    expect(result.reasons.some((item) => item.label.includes('动作质量'))).toBe(true);
  });

  it('lowers confidence after recent history edits', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: stableHistory(),
      e1rmProfile: highE1rmProfile('high'),
      effectiveSetSummary: { completedSets: 18, effectiveSets: 18, highConfidenceEffectiveSets: 16 },
      recentEdits: [{ editedAt: '2026-04-28T10:00:00.000Z', fields: ['sets'] }],
    });

    expect(result.reasons.some((item) => item.label.includes('历史记录刚修正'))).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('raises confidence when RIR records are complete', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: stableHistory(),
      e1rmProfile: highE1rmProfile('high'),
    });

    expect(result.reasons.some((item) => item.label.includes('余力记录完整') && item.effect === 'raise_confidence')).toBe(true);
  });

  it('detects volatile load feedback and recent replacements', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: [
        session(0, { replacement: true }),
        session(1),
        session(2),
      ],
      loadFeedback: [
        { exerciseId: 'bench-press', sessionId: 'session-0', date: '2026-04-01', feedback: 'too_heavy' },
        { exerciseId: 'bench-press', sessionId: 'session-1', date: '2026-04-02', feedback: 'too_light' },
      ],
    });

    expect(result.reasons.some((item) => item.label.includes('重量反馈波动'))).toBe(true);
    expect(result.reasons.some((item) => item.label.includes('近期替代动作'))).toBe(true);
  });

  it('ignores test and excluded sessions when counting recommendation evidence', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: [
        session(0, { dataFlag: 'test' }),
        session(1, { dataFlag: 'excluded' }),
      ],
    });

    expect(result.level).toBe('low');
    expect(result.summary).toContain('保守参考');
  });

  it('keeps visible output Chinese and avoids raw enum leakage', () => {
    const result = buildRecommendationConfidence({
      exerciseId: 'bench-press',
      history: [
        session(0, { setOverrides: [{ techniqueQuality: 'poor', rir: '' }] }),
      ],
      e1rmProfile: highE1rmProfile('low'),
      loadFeedback: [{ exerciseId: 'bench-press', sessionId: 'session-0', date: '2026-04-01', feedback: 'too_heavy' }],
      trainingLevel: 'unknown',
      recentEdits: 1,
    });
    const text = visibleText(result);

    expect(text).not.toMatch(/\b(low|medium|high|too_heavy|too_light|good|unknown|raise_confidence|lower_confidence|informational|undefined|null|test|excluded)\b/i);
    expect(text).toMatch(/[推荐可信度保守记录余力动作质量]/);
  });
});
