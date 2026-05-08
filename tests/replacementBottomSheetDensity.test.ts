import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildReplacementCardCopy, ReplacementOptionCard } from '../src/features/TrainingFocusView';
import type { SmartReplacementRecommendation } from '../src/engines/smartReplacementEngine';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const recommendation = (overrides: Partial<SmartReplacementRecommendation> = {}): SmartReplacementRecommendation => ({
  exerciseId: 'assisted-dip',
  exerciseName: '辅助双杠臂屈伸',
  priority: 'secondary',
  fatigueCost: 'high',
  reason: '复合动作替代，疲劳成本更高，不是飞鸟类完全等价替代，PR / e1RM 按实际动作独立统计。',
  warnings: ['不是飞鸟类完全等价替代，统计按辅助双杠臂屈伸计算。'],
  ...overrides,
});

describe('replacement BottomSheet card density', () => {
  it('builds a short decision copy without leaking long stats copy into the default card', () => {
    const copy = buildReplacementCardCopy(recommendation());

    expect(copy.exerciseName).toBe('辅助双杠臂屈伸');
    expect(copy.rankLabel).toBe('可选');
    expect(copy.shortReason).toBe('复合动作替代，疲劳成本更高。');
    expect(copy.detailReason).toContain('不是飞鸟类完全等价替代');
    expect(copy.statsNote).toContain('统计按实际执行动作计算');
    expect(copy.shortReason).not.toMatch(/PR|e1RM|assisted-dip|undefined|null/);
  });

  it('renders only action name, rank, short reason, and choose/details actions by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReplacementOptionCard, {
        option: recommendation(),
        expanded: false,
        onToggleDetails: () => undefined,
        onChoose: () => undefined,
      }),
    );
    const text = visibleText(html);

    expect(text).toContain('辅助双杠臂屈伸');
    expect(text).toContain('可选');
    expect(text).toContain('复合动作替代，疲劳成本更高。');
    expect(text).toContain('选择此动作');
    expect(text).toContain('查看详情');
    expect(text).not.toMatch(/PR|e1RM|疲劳成本：|muscleContribution|assisted-dip|secondary|undefined|null|__alt_/);
  });

  it('prioritizes equipment short reasons when crowded-gym context is present', () => {
    const copy = buildReplacementCardCopy(
      recommendation({
        exerciseId: 'smith-incline-press',
        exerciseName: '史密斯上斜卧推',
        priority: 'primary',
        fatigueCost: 'medium',
        reason: '避开哑铃区，可在固定器械区完成。统计按实际执行动作计算，不污染原动作。',
        warnings: [],
      }),
    );

    expect(copy.shortReason).toBe('避开哑铃区，可在固定器械区完成。');
    expect(copy.shortReason).not.toMatch(/dumbbell|machine|undefined|null/);
  });
});
