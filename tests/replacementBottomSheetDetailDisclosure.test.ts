import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReplacementOptionCard, resetReplacementPickerUiState, toggleReplacementPickerDetails } from '../src/features/TrainingFocusView';
import type { SmartReplacementRecommendation } from '../src/engines/smartReplacementEngine';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const option = (exerciseId: string, exerciseName: string): SmartReplacementRecommendation => ({
  exerciseId,
  exerciseName,
  priority: 'secondary',
  fatigueCost: 'high',
  reason: `${exerciseName} 是可接受替代，但不是完全等价。完整说明仅在详情中显示。`,
  warnings: [`${exerciseName} 的统计按实际执行动作计算，不污染原动作。`],
});

describe('replacement BottomSheet detail disclosure', () => {
  it('tracks one expanded candidate at a time', () => {
    const initial = resetReplacementPickerUiState();
    const first = toggleReplacementPickerDetails(initial, 'assisted-dip');
    const second = toggleReplacementPickerDetails(first, 'pec-deck-fly');
    const closed = toggleReplacementPickerDetails(second, 'pec-deck-fly');

    expect(first.expandedReplacementDetailsId).toBe('assisted-dip');
    expect(second.expandedReplacementDetailsId).toBe('pec-deck-fly');
    expect(closed.expandedReplacementDetailsId).toBeNull();
  });

  it('renders full reason, fatigue, and stats notes only for the expanded candidate', () => {
    const expandedHtml = renderToStaticMarkup(
      React.createElement(ReplacementOptionCard, {
        option: option('assisted-dip', '辅助双杠臂屈伸'),
        expanded: true,
        onToggleDetails: () => undefined,
        onChoose: () => undefined,
      }),
    );
    const collapsedHtml = renderToStaticMarkup(
      React.createElement(ReplacementOptionCard, {
        option: option('pec-deck-fly', '蝴蝶机夹胸'),
        expanded: false,
        onToggleDetails: () => undefined,
        onChoose: () => undefined,
      }),
    );

    const expandedText = visibleText(expandedHtml);
    const collapsedText = visibleText(collapsedHtml);

    expect(expandedText).toContain('完整说明仅在详情中显示');
    expect(expandedText).toContain('疲劳成本：高');
    expect(expandedText).toContain('统计按实际执行动作计算，不污染原动作');
    expect(expandedText).toContain('收起详情');
    expect(collapsedText).toContain('查看详情');
    expect(collapsedText).not.toContain('完整说明仅在详情中显示');
    expect(collapsedText).not.toContain('疲劳成本：高');
    expect(`${expandedText} ${collapsedText}`).not.toMatch(/undefined|null|__alt_/);
  });
});
