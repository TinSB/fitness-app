import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ReplacementOptionCard,
  buildReplacementCardCopy,
  buildReplacementDisplayGroups,
} from '../src/features/TrainingFocusView';
import type { SmartReplacementRecommendation } from '../src/engines/smartReplacementEngine';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const option = (exerciseId: string, exerciseName: string, priority: SmartReplacementRecommendation['priority']): SmartReplacementRecommendation => ({
  exerciseId,
  exerciseName,
  priority,
  fatigueCost: 'medium',
  reason: `${exerciseName} 可以作为本次替代。统计按实际执行动作计算，不污染原动作。`,
  warnings: [],
});

describe('TrainingFocusView replacement UI helpers', () => {
  it('keeps replacement candidates visible while adding top recommendation grouping', () => {
    const options = [
      option('assisted-pull-up', '辅助引体向上', 'primary'),
      option('pull-up', '引体向上', 'primary'),
      option('single-arm-lat-pulldown', '单臂高位下拉', 'secondary'),
    ];

    const groups = buildReplacementDisplayGroups(options);

    expect(groups[0].title).toBe('推荐优先');
    expect(groups[0].options.map((item) => item.exerciseId)).toEqual(['assisted-pull-up', 'pull-up']);
    expect(groups[1].title).toBe('其他可选');
    expect(groups[1].options.map((item) => item.exerciseId)).toEqual(['single-arm-lat-pulldown']);
  });

  it('renders the compact replacement card and keeps long statistics copy behind details', () => {
    const compactHtml = renderToStaticMarkup(
      React.createElement(ReplacementOptionCard, {
        option: option('chest-supported-row', '胸托划船', 'primary'),
        expanded: false,
        onToggleDetails: () => undefined,
        onChoose: () => undefined,
      }),
    );
    const detailHtml = renderToStaticMarkup(
      React.createElement(ReplacementOptionCard, {
        option: option('chest-supported-row', '胸托划船', 'primary'),
        expanded: true,
        onToggleDetails: () => undefined,
        onChoose: () => undefined,
      }),
    );
    const compactText = visibleText(compactHtml);
    const detailText = visibleText(detailHtml);

    expect(compactText).toContain('胸托划船');
    expect(compactText).toContain('优先');
    expect(compactText).toContain('选择此动作');
    expect(compactText).toContain('查看详情');
    expect(compactText).not.toContain('统计按实际执行动作计算');
    expect(detailText).toContain('统计按实际执行动作计算，不污染原动作。');
    expect(detailText).toContain('疲劳成本：中');
    expect(`${compactText} ${detailText}`).not.toMatch(/chest-supported-row|primary|undefined|null|__alt_/);
  });

  it('uses Chinese replacement labels and short copy without raw priority values', () => {
    const copy = buildReplacementCardCopy(option('single-arm-lat-pulldown', '单臂高位下拉', 'angle_variation'));

    expect(copy.rankLabel).toBe('角度相近');
    expect(copy.shortReason).toBe('单臂高位下拉 可以作为本次替代。');
    expect(copy.shortReason).not.toMatch(/angle_variation|undefined|null/);
  });
});
