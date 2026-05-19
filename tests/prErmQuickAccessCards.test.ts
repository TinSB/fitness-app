import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PrErmQuickAccessCards } from '../src/uiOs/history/PrErmQuickAccessCards';

describe('PrErmQuickAccessCards', () => {
  it('renders PR and e1RM quick access without inventing missing records', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrErmQuickAccessCards, {
        items: [
          { exerciseId: 'bench-press', label: '卧推', prLabel: '100kg x 5', e1rmLabel: '117kg e1RM', date: '2026-05-04', hasData: true },
          { exerciseId: 'deadlift', label: '硬拉', prLabel: '暂无正式记录', e1rmLabel: '暂无 e1RM', hasData: false },
        ],
        onSelectExercise: vi.fn(),
      }),
    );

    expect(html).toContain('PR / e1RM 快速入口');
    expect(html).toContain('卧推');
    expect(html).toContain('100kg x 5');
    expect(html).toContain('117kg e1RM');
    expect(html).toContain('硬拉');
    expect(html).toContain('暂无正式记录');
  });
});
