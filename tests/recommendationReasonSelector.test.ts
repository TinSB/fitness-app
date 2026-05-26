import { describe, expect, it } from 'vitest';
import { selectRecommendationReasons } from '../src/engines/recommendationReasonSelector';
import type { RecommendationFactor, RecommendationTrace } from '../src/engines/recommendationTraceEngine';

const factor = (overrides: Partial<RecommendationFactor> & { id: string }): RecommendationFactor => ({
  id: overrides.id,
  label: overrides.label ?? overrides.id,
  reason: overrides.reason ?? overrides.id,
  source: overrides.source ?? 'history',
  effect: overrides.effect ?? 'maintain',
  magnitude: overrides.magnitude ?? 'small',
});

const trace = (overrides: Partial<RecommendationTrace>): RecommendationTrace => ({
  sessionTemplateId: 'push-a',
  primaryGoal: '增肌',
  trainingMode: '综合',
  trainingLevel: '中级',
  globalFactors: [],
  exerciseFactors: {},
  volumeFactors: [],
  loadFeedbackFactors: [],
  finalSummary: '',
  ...overrides,
});

describe('recommendationReasonSelector', () => {
  it('returns empty for missing trace', () => {
    expect(selectRecommendationReasons(undefined)).toEqual([]);
  });

  it('filters out informational template factors', () => {
    const result = selectRecommendationReasons(trace({
      globalFactors: [
        factor({ id: 'template', source: 'template', effect: 'informational', magnitude: 'small', reason: 'noise' }),
        factor({ id: 'readiness', source: 'readiness', effect: 'decrease', magnitude: 'large', reason: '准备度偏低' }),
      ],
    }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('global:readiness');
  });

  it('prioritizes block / decrease / large factors over informational ones', () => {
    const result = selectRecommendationReasons(trace({
      globalFactors: [
        factor({ id: 'history', source: 'history', effect: 'informational', magnitude: 'small', reason: 'history info' }),
      ],
      volumeFactors: [
        factor({ id: 'chest', source: 'muscleVolume', effect: 'decrease', magnitude: 'moderate', reason: '胸训练量接近上限' }),
      ],
      loadFeedbackFactors: [
        factor({ id: 'feedback', source: 'loadFeedback', effect: 'decrease', magnitude: 'small', reason: '上次反馈偏重' }),
      ],
    }));
    expect(result[0].id).toBe('volume:chest');
  });

  it('respects the limit option', () => {
    const result = selectRecommendationReasons(trace({
      globalFactors: [
        factor({ id: 'a', source: 'readiness', effect: 'decrease', magnitude: 'large', reason: 'A' }),
        factor({ id: 'b', source: 'readiness', effect: 'decrease', magnitude: 'moderate', reason: 'B' }),
        factor({ id: 'c', source: 'readiness', effect: 'decrease', magnitude: 'small', reason: 'C' }),
        factor({ id: 'd', source: 'readiness', effect: 'maintain', magnitude: 'small', reason: 'D' }),
      ],
    }), { limit: 2 });
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.id)).toEqual(['global:a', 'global:b']);
  });

  it('filters per-exercise factors when exerciseId is given', () => {
    const result = selectRecommendationReasons(trace({
      exerciseFactors: {
        'bench-press': [factor({ id: 'bench', source: 'painPattern', effect: 'decrease', magnitude: 'moderate', reason: '胸不适' })],
        'lat-pulldown': [factor({ id: 'pull', source: 'painPattern', effect: 'decrease', magnitude: 'moderate', reason: '背不适' })],
      },
    }), { exerciseId: 'bench-press' });
    expect(result).toHaveLength(1);
    expect(result[0].exerciseId).toBe('bench-press');
  });

  it('deduplicates reasons that repeat across scopes', () => {
    const sharedReason = '准备度偏低';
    const result = selectRecommendationReasons(trace({
      globalFactors: [
        factor({ id: 'a', source: 'readiness', effect: 'decrease', magnitude: 'large', reason: sharedReason }),
      ],
      exerciseFactors: {
        'bench-press': [factor({ id: 'bench-warn', source: 'recoveryConflict', effect: 'decrease', magnitude: 'moderate', reason: sharedReason })],
      },
    }));
    expect(result.filter((entry) => entry.reason === sharedReason)).toHaveLength(1);
  });
});
