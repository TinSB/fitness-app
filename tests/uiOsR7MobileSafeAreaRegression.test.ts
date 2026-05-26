import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { FocusActualSetRecordSheet } from '../src/uiOs/training/FocusActualSetRecordSheet';
import { FocusModeActionBar } from '../src/uiOs/training/FocusModeActionBar';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('UI-OS R7 mobile safe area regression lock', () => {
  it('renders bottom nav in normal shell mode with safe-area bottom inset', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'today', onNavigate: () => undefined, trainTabId: 'train' },
        React.createElement('div', null, 'normal page content'),
      ),
    );

    expect(html).toContain('normal page content');
    expect(html).toContain('fixed bottom-2 left-0 right-0');
    expect(html).toContain('env(safe-area-inset-bottom)');
    expect(html).toContain('data-bottom-nav-safe-area="viewport-edge"');
    expect(html).toContain('data-shell-safe-bottom="bottom-nav-protected"');
    expect(html).toContain('pb-0');
    expect(html).toContain('scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    for (const label of ['今日', '训练', '历史', '进步', '设置']) expect(text(html)).toContain(label);
  });

  it('hides global bottom nav in immersive Focus shell while keeping Focus action bar visible', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'train', onNavigate: () => undefined, trainTabId: 'train', immersive: true },
        React.createElement(FocusModeActionBar, {
          primaryLabel: '记录本组',
          primaryActionKind: 'open_actual_record',
          onPrimaryAction: () => undefined,
          secondaryActions: [{ id: 'copy', label: '复制上组', onClick: () => undefined }],
        }),
      ),
    );

    expect(html).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect(html).toContain('记录本组');
    expect(html).not.toContain('data-bottom-nav-hidden');
    expect(html).not.toContain('bottom-nav-protected');
    expect(html).toContain('pb-0');
  });

  it('keeps the shell source locked to normal bottom padding and immersive no-nav rules', () => {
    const shellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
    const navSource = readFileSync('src/uiOs/navigation/FloatingBottomNav.tsx', 'utf8');

    expect(shellSource).toContain('{!immersive ? <BottomNav');
    expect(shellSource).toContain("data-shell-safe-bottom={immersive ? 'immersive' : 'bottom-nav-protected'}");
    expect(shellSource).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))] scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(shellSource).toContain("data-shell-bottom-reserve={immersive ? 'none' : 'content-clearance'}");
    expect(navSource).toContain('data-bottom-nav-safe-area="viewport-edge"');
    expect(navSource).toContain('pointer-events-none');
  });

  it('renders actual record bottom sheet above Focus content without relying on global nav', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'train', onNavigate: () => undefined, trainTabId: 'train', immersive: true },
        React.createElement('div', null, 'Focus content'),
        React.createElement(FocusActualSetRecordSheet, {
          isOpen: true,
          onClose: () => undefined,
          weightUnit: 'lb',
          weightValue: 45,
          repsValue: undefined,
          rirValue: undefined,
          noteValue: '',
          missingInput: true,
          onWeightChange: () => undefined,
          onRepsChange: () => undefined,
          onRirChange: () => undefined,
          onNoteChange: () => undefined,
          onComplete: () => undefined,
        }),
      ),
    );

    expect(html).toContain('Focus content');
    expect(html).toContain('data-focus-actual-set-record-sheet="bottom-sheet"');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('data-bottom-nav-hidden');
  });
});
