import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { Drawer } from '../src/ui/Drawer';
import { BottomSheet as LegacyBottomSheet } from '../src/ui/BottomSheet';
import { Card } from '../src/ui/Card';
import { ListItem } from '../src/ui/ListItem';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R9.1 Training Detail and Record Detail light theme parity', () => {
  it('renders Training Detail drawer root and cards as light semantic surfaces', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(
          Drawer,
          { open: true, title: '训练详情', onClose: () => undefined },
          React.createElement(Card, null, React.createElement(ListItem, { title: '动作记录', description: '45 lb × 10' })),
        ),
      ),
    );

    expect(html).toContain('data-training-detail-surface="light"');
    expect(html).toContain('data-record-detail-surface="light"');
    expect(html).toContain('data-theme-surface="training_detail_surface"');
    expect(html).toContain('bg-slate-50 text-slate-950');
    expect(html).toContain('data-theme-mode="light"');
    expect(html).not.toContain('data-training-detail-surface="dark"');
  });

  it('renders legacy training detail sheets as light sheets in normal light mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(LegacyBottomSheet, { open: true, title: '推荐依据', onClose: () => undefined }, '推荐内容'),
      ),
    );

    expect(html).toContain('data-theme-surface="bottom_sheet"');
    expect(html).toContain('data-theme-mode="light"');
    expect(html).toContain('bg-white text-slate-950');
    expect(html).not.toContain('data-theme-mode="dark"');
  });

  it('marks Record detail root as active-theme semantic surface', () => {
    const source = read('src/features/RecordView.tsx');

    expect(source).toContain('useUiTheme');
    expect(source).toContain('data-record-detail-surface={resolvedTheme}');
    expect(source).toContain('data-theme-surface="record_detail_surface"');
    expect(source).toContain("isDarkTheme ? recordDarkDescendantOverrides : ''");
  });
});
