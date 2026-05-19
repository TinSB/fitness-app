import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BottomSheet as LegacyBottomSheet } from '../src/ui/BottomSheet';
import { BottomSheet as UiOsBottomSheet } from '../src/uiOs/surfaces/BottomSheet';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UI-OS R8.5 dark bottom sheet parity', () => {
  it('renders legacy training sheets as semantic dark bottom sheets', () => {
    const html = renderToStaticMarkup(
      React.createElement(LegacyBottomSheet, { open: true, title: '切换动作', onClose: () => undefined }, '动作列表'),
    );

    expect(html).toContain('data-theme-surface="bottom_sheet"');
    expect(html).toContain('data-theme-mode="dark"');
    expect(html).toContain('bg-[#1c1c1e]');
    expect(html).not.toMatch(/\bbg-white(?:\s|["'`])/);
  });

  it('keeps UI-OS actual-record sheets dark too', () => {
    const html = renderToStaticMarkup(
      React.createElement(UiOsBottomSheet, { isOpen: true, title: '实际记录', onClose: () => undefined }, '记录本组'),
    );

    expect(html).toContain('data-theme-surface="bottom_sheet"');
    expect(html).toContain('data-theme-mode="dark"');
    expect(html).not.toMatch(/\bbg-white(?:\s|["'`])/);
  });

  it('wires Focus switch and recommendation basis sheets through the dark sheet owner', () => {
    const source = read('src/features/TrainingFocusView.tsx');

    expect(source).toContain('<BottomSheet open={showExercisePicker} title="切换动作"');
    expect(source).toContain('<BottomSheet open={showReplacementPicker} title="选择本次实际执行动作"');
    expect(source).toContain('<BottomSheet open={showExplanationSheet} title="推荐依据"');
    expect(read('src/ui/BottomSheet.tsx')).toContain('data-theme-surface="bottom_sheet"');
  });
});
