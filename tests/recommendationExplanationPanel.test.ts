import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RecommendationFactor, RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { RecommendationExplanationPanel } from '../src/ui/RecommendationExplanationPanel';

const makeFactor = (id: string, reason: string, overrides: Partial<RecommendationFactor> = {}): RecommendationFactor => ({
  id,
  label: id,
  effect: overrides.effect || 'decrease',
  magnitude: overrides.magnitude || 'moderate',
  source: overrides.source || 'readiness',
  reason,
});

const makeTrace = (factors: RecommendationFactor[]): RecommendationTrace => ({
  sessionTemplateId: 'legs-a',
  primaryGoal: '肌肥大（增肌）',
  trainingMode: '综合',
  trainingLevel: '中阶',
  globalFactors: factors,
  exerciseFactors: {},
  volumeFactors: [],
  loadFeedbackFactors: [],
  finalSummary: '这是正常差异：推荐会根据近期状态调整。',
});

const renderPanel = (props: React.ComponentProps<typeof RecommendationExplanationPanel>) =>
  renderToStaticMarkup(React.createElement(RecommendationExplanationPanel, props));

describe('RecommendationExplanationPanel', () => {
  it('renders the default title', () => {
    const html = renderPanel({ trace: makeTrace([]) });

    expect(html).toContain('为什么这样推荐？');
  });

  it('shows only maxVisibleFactors before the more-reasons section', () => {
    const html = renderPanel({
      trace: makeTrace([
        makeFactor('a', '第一条主要原因。', { source: 'painPattern', magnitude: 'large' }),
        makeFactor('b', '第二条主要原因。', { source: 'loadFeedback' }),
        makeFactor('c', '第三条主要原因。', { source: 'template', effect: 'informational', magnitude: 'small' }),
      ]),
      maxVisibleFactors: 2,
    });
    const visiblePart = html.split('查看更多原因')[0] || '';

    expect(visiblePart).toContain('第一条主要原因。');
    expect(visiblePart).toContain('第二条主要原因。');
    expect(visiblePart).not.toContain('第三条主要原因。');
    expect(html).toContain('查看更多原因');
  });

  it('shows productized warning notices', () => {
    const html = renderPanel({
      trace: makeTrace([makeFactor('a', '主要原因。')]),
      warnings: ['两个 context 看起来完全相同但推荐不同，可能是 bug。'],
    });

    expect(html).toContain('可能需要检查');
    expect(html).toContain('关键条件相同但推荐差异较大');
    expect(html).not.toContain('bug');
  });

  it('supports compact mode for Focus Mode', () => {
    const html = renderPanel({
      trace: makeTrace([makeFactor('a', '主要原因。')]),
      compact: true,
      defaultOpen: true,
    });

    expect(html).toContain('open=""');
    expect(html).toContain('text-xs');
  });
});
