import { describe, expect, it } from 'vitest';
import { buildSessionQualityResult } from '../src/engines/sessionQualityEngine';
import type { LoadFeedback, PainPattern, TrainingSession, TrainingSetLog } from '../src/models/training-model';

const workingSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: overrides.id || `set-${Math.random()}`,
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

const makeSession = (overrides: {
  sets?: TrainingSetLog[];
  plannedSets?: number;
  supportPlanned?: number;
  supportCompleted?: number;
  dataFlag?: TrainingSession['dataFlag'];
  loadFeedback?: LoadFeedback[];
} = {}): TrainingSession => ({
  id: 'quality-session',
  date: '2026-04-28',
  templateId: 'push-a',
  templateName: '推 A',
  trainingMode: 'hybrid',
  completed: true,
  dataFlag: overrides.dataFlag || 'normal',
  exercises: [
    {
      id: 'bench-press',
      name: '卧推',
      muscle: '胸',
      kind: 'compound',
      repMin: 6,
      repMax: 10,
      rest: 120,
      startWeight: 60,
      sets: overrides.sets || [
        workingSet({ id: 'bench-1' }),
        workingSet({ id: 'bench-2' }),
        workingSet({ id: 'bench-3' }),
      ],
      prescription: {
        mode: 'hybrid',
        modeLabel: '综合',
        loadRange: '中等',
        repRange: [6, 10],
        sets: overrides.plannedSets ?? 3,
        restSec: 120,
        targetRir: [1, 3],
        rule: '测试处方',
      },
    },
  ],
  supportExerciseLogs: overrides.supportPlanned
    ? [
        {
          moduleId: 'support',
          exerciseId: 'face-pull',
          exerciseName: '面拉',
          blockType: 'correction',
          plannedSets: overrides.supportPlanned,
          completedSets: overrides.supportCompleted ?? overrides.supportPlanned,
        },
      ]
    : [],
  loadFeedback: overrides.loadFeedback || [],
});

const visibleText = (result: ReturnType<typeof buildSessionQualityResult>) =>
  [
    result.title,
    result.summary,
    ...result.positives.flatMap((item) => [item.label, item.reason]),
    ...result.issues.flatMap((item) => [item.label, item.reason]),
    ...result.nextSuggestions,
  ].join('\n');

describe('sessionQualityEngine', () => {
  it('returns high quality for high completion and high-confidence effective sets', () => {
    const result = buildSessionQualityResult({
      session: makeSession(),
    });

    expect(result.level).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(82);
    expect(result.title).toBe('本次训练质量：高');
    expect(result.positives.some((item) => item.label.includes('主训练完成度'))).toBe(true);
    expect(result.positives.some((item) => item.reason.includes('高置信有效组'))).toBe(true);
  });

  it('downgrades quality when completion rate is low', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        plannedSets: 4,
        sets: [
          workingSet({ id: 'bench-1' }),
          workingSet({ id: 'bench-2', weight: 0, actualWeightKg: 0, reps: 0, done: false }),
          workingSet({ id: 'bench-3', weight: 0, actualWeightKg: 0, reps: 0, done: false }),
          workingSet({ id: 'bench-4', weight: 0, actualWeightKg: 0, reps: 0, done: false }),
        ],
      }),
    });

    expect(result.level).toBe('low');
    expect(result.issues.some((item) => item.label.includes('完成不足'))).toBe(true);
    expect(result.nextSuggestions.join('\n')).toContain('关键主训练');
  });

  it('downgrades quality when multiple pain flags are present', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        sets: [
          workingSet({ id: 'bench-1', painFlag: true, painArea: '肩', painSeverity: 3 }),
          workingSet({ id: 'bench-2', painFlag: true, painArea: '肩', painSeverity: 3 }),
          workingSet({ id: 'bench-3' }),
        ],
      }),
    });

    expect(result.level).not.toBe('high');
    expect(result.issues.some((item) => item.label.includes('不适'))).toBe(true);
    expect(visibleText(result)).toContain('不会作为高质量亮点');
  });

  it('downgrades quality for poor technique', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        sets: [
          workingSet({ id: 'bench-1', techniqueQuality: 'poor' }),
          workingSet({ id: 'bench-2', techniqueQuality: 'poor' }),
          workingSet({ id: 'bench-3', techniqueQuality: 'acceptable' }),
        ],
      }),
    });

    expect(result.level).not.toBe('high');
    expect(result.issues.some((item) => item.label.includes('动作质量'))).toBe(true);
    expect(result.nextSuggestions.join('\n')).toContain('动作质量');
  });

  it('lowers confidence but not necessarily quality when RIR is missing', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        sets: [
          workingSet({ id: 'bench-1', rir: undefined }),
          workingSet({ id: 'bench-2', rir: '' }),
          workingSet({ id: 'bench-3', rir: undefined }),
        ],
      }),
    });

    expect(result.level).toBe('high');
    expect(result.confidence).toBe('low');
    expect(result.issues.some((item) => item.label.includes('RIR'))).toBe(true);
  });

  it('marks test sessions as not participating in statistics', () => {
    const result = buildSessionQualityResult({
      session: makeSession({ dataFlag: 'test' }),
    });
    const text = visibleText(result);

    expect(result.summary).toContain('测试数据');
    expect(result.summary).toContain('不参与统计');
    expect(result.issues.some((item) => item.reason.includes('不会参与训练统计'))).toBe(true);
    expect(text).not.toMatch(/\btest\b/);
  });

  it('uses pain patterns and load feedback as quality signals', () => {
    const painPattern: PainPattern = {
      area: '肩',
      exerciseId: 'bench-press',
      frequency: 3,
      severityAvg: 3.8,
      lastOccurredAt: '2026-04-27',
      suggestedAction: 'substitute',
    };
    const result = buildSessionQualityResult({
      session: makeSession({
        loadFeedback: [{ exerciseId: 'bench-press', sessionId: 'quality-session', date: '2026-04-28', feedback: 'too_heavy' }],
      }),
      painPatterns: [painPattern],
    });
    const text = visibleText(result);

    expect(result.issues.some((item) => item.label.includes('近期不适'))).toBe(true);
    expect(result.issues.some((item) => item.label.includes('偏重'))).toBe(true);
    expect(text).toContain('不宜直接加重');
  });

  it('returns insufficient data when there are no completed working or support sets', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        plannedSets: 3,
        sets: [
          workingSet({ id: 'bench-1', weight: 0, actualWeightKg: 0, reps: 0, done: false }),
          workingSet({ id: 'bench-2', weight: 0, actualWeightKg: 0, reps: 0, done: false }),
        ],
      }),
    });

    expect(result.level).toBe('insufficient_data');
    expect(result.confidence).toBe('low');
    expect(result.title).toBe('本次训练质量：数据不足');
  });

  it('uses provided effective set summary without recalculating the quality decision', () => {
    const result = buildSessionQualityResult({
      session: makeSession(),
      effectiveSetSummary: {
        completedSets: 3,
        effectiveSets: 0,
        highConfidenceEffectiveSets: 0,
      },
    });

    expect(result.level).not.toBe('high');
    expect(result.issues.some((item) => item.label.includes('高质量有效组不足'))).toBe(true);
  });

  it('keeps visible text Chinese and avoids raw enum leakage', () => {
    const result = buildSessionQualityResult({
      session: makeSession({
        dataFlag: 'excluded',
        sets: [
          workingSet({ id: 'bench-1', techniqueQuality: 'poor', painFlag: true, rir: '' }),
          workingSet({ id: 'bench-2', reps: 80 }),
        ],
        loadFeedback: [{ exerciseId: 'bench-press', sessionId: 'quality-session', date: '2026-04-28', feedback: 'too_heavy' }],
      }),
    });
    const text = visibleText(result);

    expect(text).not.toMatch(/\b(high|medium|low|insufficient_data|too_heavy|too_light|good|test|excluded|undefined|null|working|warmup)\b/i);
    expect(text).toMatch(/[训练质量动作不适统计余力]/);
  });
});
