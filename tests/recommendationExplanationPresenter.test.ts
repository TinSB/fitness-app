import { describe, expect, it } from 'vitest';
import type { RecommendationFactor, RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import {
  buildRecommendationExplanationViewModel,
  buildSessionRecommendationTrace,
} from '../src/presenters/recommendationExplanationPresenter';

const factor = (overrides: Partial<RecommendationFactor>): RecommendationFactor => ({
  id: overrides.id || 'factor',
  label: overrides.label || 'raw',
  effect: overrides.effect || 'informational',
  magnitude: overrides.magnitude || 'small',
  source: overrides.source || 'defaultPolicy',
  reason: overrides.reason || '默认说明。',
});

const trace = (factors: RecommendationFactor[], finalSummary = '推荐说明。'): RecommendationTrace => ({
  sessionTemplateId: 'push-a',
  primaryGoal: '肌肥大（增肌）',
  trainingMode: '综合',
  trainingLevel: '中阶',
  globalFactors: factors,
  exerciseFactors: {},
  volumeFactors: [],
  loadFeedbackFactors: [],
  finalSummary,
});

describe('recommendationExplanationPresenter', () => {
  it('sorts high impact factors before lower impact factors', () => {
    const vm = buildRecommendationExplanationViewModel(
      trace([
        factor({ id: 'goal', source: 'primaryGoal', effect: 'informational', magnitude: 'small', reason: '主目标用于长期方向。' }),
        factor({ id: 'pain', source: 'painPattern', effect: 'decrease', magnitude: 'large', reason: '近期有不适记录，本次建议更保守。' }),
        factor({ id: 'feedback', source: 'loadFeedback', effect: 'decrease', magnitude: 'moderate', reason: '最近反馈偏重，本次略保守。' }),
      ]),
    );

    expect(vm.primaryFactors[0]?.label).toBe('不适记录');
    expect(vm.primaryFactors[0]?.effectLabel).toBe('保守建议');
    expect(vm.primaryFactors[1]?.label).toBe('重量反馈');
  });

  it('moves informational factors into secondary factors by default', () => {
    const vm = buildRecommendationExplanationViewModel(
      trace([
        factor({ id: 'mode', source: 'trainingMode', effect: 'informational', magnitude: 'small', reason: '训练侧重用于本次安排。' }),
        factor({ id: 'readiness', source: 'readiness', effect: 'maintain', magnitude: 'small', reason: '准备度正常，维持当前建议。' }),
      ]),
    );

    expect(vm.primaryFactors.map((item) => item.label)).toEqual(['准备度']);
    expect(vm.secondaryFactors.map((item) => item.label)).toContain('训练侧重');
  });

  it('uses a default summary when there is no trace', () => {
    const vm = buildRecommendationExplanationViewModel(null);

    expect(vm.summary).toBe('当前主要依据起始模板和默认处方，系统仍在积累你的训练数据。');
    expect(vm.primaryFactors).toHaveLength(0);
  });

  it('does not expose raw enum keys or empty values', () => {
    const vm = buildRecommendationExplanationViewModel(
      trace([
        factor({
          id: 'raw',
          source: 'trainingMode',
          effect: 'decrease',
          magnitude: 'large',
          reason: 'because trainingMode decrease undefined null',
        }),
      ]),
    );
    const text = [vm.summary, ...vm.primaryFactors.flatMap((item) => [item.label, item.effectLabel, item.reason])].join(' ');

    expect(text).not.toMatch(/\b(increase|decrease|primaryGoal|trainingMode|undefined|null)\b/);
    expect(text).toContain('训练侧重');
    expect(text).toContain('保守建议');
  });

  it('builds compact session traces from existing training explanations', () => {
    const sessionTrace = buildSessionRecommendationTrace({
      templateId: 'push-a',
      trainingMode: 'hybrid',
      explanations: ['本次按当前训练记录保持保守。'],
    });

    expect(sessionTrace.globalFactors[0]?.reason).toContain('保持保守');
    expect(sessionTrace.trainingMode).toBe('综合');
  });
});
