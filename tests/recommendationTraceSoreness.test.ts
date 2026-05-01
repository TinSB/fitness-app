import { describe, expect, it } from 'vitest';
import { buildRecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';
import { todayKey } from '../src/engines/engineUtils';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

const visibleText = (trace: ReturnType<typeof buildRecommendationTrace>) =>
  [
    ...trace.globalFactors.flatMap((factor) => [factor.label, factor.reason]),
    ...Object.values(trace.exerciseFactors)
      .flat()
      .flatMap((factor) => [factor.label, factor.reason]),
  ].join(' ');

describe('recommendationTrace soreness source boundaries', () => {
  it('uses recoveryConflict instead of painPattern for template conflicts from Today soreness', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        selectedTemplateId: 'pull-a',
        todayStatus: makeStatus({ date: todayKey(), soreness: ['背'] }),
      }),
      template: getTemplate('pull-a'),
    });
    const recoveryFactor = trace.globalFactors.find((factor) => factor.id === 'recovery-template-conflict');

    expect(recoveryFactor?.source).toBe('recoveryConflict');
    expect(trace.globalFactors.some((factor) => factor.id === 'recovery-template-conflict' && factor.source === 'painPattern')).toBe(false);
    expect(visibleText(trace)).not.toContain('不适信号');
  });

  it('uses soreness for non-blocking Today soreness and does not create painPattern', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        selectedTemplateId: 'legs-a',
        todayStatus: makeStatus({ date: todayKey(), soreness: ['肩'] }),
      }),
      template: getTemplate('legs-a'),
    });

    expect(trace.globalFactors.some((factor) => factor.source === 'soreness')).toBe(true);
    expect(trace.globalFactors.some((factor) => factor.source === 'painPattern')).toBe(false);
  });

  it('renders Today soreness as recovery copy, not discomfort copy', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        selectedTemplateId: 'pull-a',
        todayStatus: makeStatus({ date: todayKey(), soreness: ['背'] }),
      }),
      template: getTemplate('pull-a'),
    });
    const vm = buildRecommendationExplanationViewModel(trace);
    const text = [vm.summary, ...vm.primaryFactors.flatMap((item) => [item.label, item.reason])].join(' ');

    expect(text).toMatch(/恢复提醒|酸痛状态/);
    expect(text).not.toContain('不适信号');
  });
});
