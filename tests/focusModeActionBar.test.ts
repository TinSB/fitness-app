import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FocusModeActionBar } from '../src/uiOs/training/FocusModeActionBar';

describe('FocusModeActionBar', () => {
  it('renders one dominant primary action and visually secondary tools', () => {
    const html = renderToStaticMarkup(
      React.createElement(FocusModeActionBar, {
        primaryLabel: '记录本组',
        primaryActionKind: 'open_actual_record',
        onPrimaryAction: () => undefined,
        secondaryActions: [
          { id: 'copy', label: '复制上组', onClick: () => undefined },
          { id: 'pain', label: '标记不适', onClick: () => undefined, tone: 'danger' },
          { id: 'replace', label: '替代动作', onClick: () => undefined },
        ],
        summary: '当前记录：缺少重量或次数',
      }),
    );

    expect(html).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect(html).toContain('data-primary-action-kind="open_actual_record"');
    expect(html).toContain('记录本组');
    expect(html).toContain('data-focus-secondary-actions="visual-secondary"');
    expect(html).toContain('更多');
    expect(html).not.toContain('复制上组');
    expect(html).not.toContain('标记不适');
    expect(html).not.toContain('替代动作');
  });
});
