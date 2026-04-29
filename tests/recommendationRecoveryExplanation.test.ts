import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildRecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import type { RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';
import { RecommendationExplanationPanel } from '../src/ui/RecommendationExplanationPanel';
import { getTemplate, templates } from './fixtures';

const trace: RecommendationTrace = {
  sessionTemplateId: 'legs-a',
  primaryGoal: '肌肥大（增肌）',
  trainingMode: '综合',
  trainingLevel: '中阶',
  globalFactors: [
    {
      id: 'pain-duplicate',
      label: 'painPattern',
      effect: 'decrease',
      magnitude: 'large',
      source: 'painPattern',
      reason: '你标记了背部，系统建议保守。',
    },
  ],
  exerciseFactors: {},
  volumeFactors: [],
  loadFeedbackFactors: [],
  finalSummary: '今天按恢复信号调整。',
};

const recoveryRecommendation = buildRecoveryAwareRecommendation({
  preferredTemplate: getTemplate('legs-a'),
  templates,
  sorenessAreas: ['背部'],
});

const visibleText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('recommendation recovery explanation', () => {
  it('explains affected area, conflict exercise, and keepable exercises', () => {
    const vm = buildRecommendationExplanationViewModel(trace, { recoveryRecommendation });
    const text = [
      vm.summary,
      ...vm.primaryFactors.flatMap((factor) => [factor.label, factor.effectLabel, factor.reason]),
      ...vm.secondaryFactors.flatMap((factor) => [factor.label, factor.effectLabel, factor.reason]),
    ].join('\n');

    expect(text).toContain('背部酸痛或恢复信号');
    expect(text).toContain('罗马尼亚硬拉');
    expect(text).toContain('腿举');
    expect(text).toContain('腿弯举');
    expect(text).toContain('提踵');
    expect(text).toContain('腿 A（保守版）');
    expect(text).toContain('不会修改原训练模板');
  });

  it('does not repeat the same recovery warning as a separate pain factor', () => {
    const vm = buildRecommendationExplanationViewModel(trace, { recoveryRecommendation });
    const labels = vm.primaryFactors.map((factor) => factor.label);
    const text = vm.primaryFactors.map((factor) => factor.reason).join('\n');

    expect(labels.filter((label) => label === '恢复信号')).toHaveLength(1);
    expect(labels).not.toContain('不适信号');
    expect(text.match(/罗马尼亚硬拉/g)).toHaveLength(1);
  });

  it('renders compact panel copy without raw enum text', () => {
    const html = renderToStaticMarkup(
      React.createElement(RecommendationExplanationPanel, {
        trace,
        recoveryRecommendation,
        compact: true,
        defaultOpen: true,
      }),
    );
    const text = visibleText(html);

    expect(text).toContain('为什么这样推荐？');
    expect(text).toContain('罗马尼亚硬拉');
    expect(text).toContain('腿举');
    expect(text).not.toMatch(/\b(modified_train|active_recovery|reduce_volume|reduce_intensity|substitute|skip|high|moderate|low|none|undefined|null)\b/);
  });
});
