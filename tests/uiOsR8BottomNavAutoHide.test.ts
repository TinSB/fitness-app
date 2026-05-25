import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { FloatingBottomNav } from '../src/uiOs/navigation/FloatingBottomNav';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

describe('UI-OS R8 bottom nav auto-hide', () => {
  it('keeps normal shell nav visible by default and marks the scroll area as bottom-nav aware', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'today', onNavigate: () => undefined, trainTabId: 'train' },
        React.createElement('div', null, 'today'),
      ),
    );

    expect(html).toContain('data-shell-scroll-area="bottom-nav-aware"');
    expect(html).toContain('data-bottom-nav-hidden="false"');
    expect(html).toContain('env(safe-area-inset-bottom)');
  });

  it('supports hidden nav state without removing safe-area behavior', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingBottomNav, {
        items,
        activeId: 'today',
        onNavigate: () => undefined,
        trainTabId: 'train',
        hidden: true,
      }),
    );

    expect(html).toContain('data-bottom-nav-hidden="true"');
    expect(html).toContain('translate-y-[calc(100%+0.5rem+env(safe-area-inset-bottom))]');
    expect(html).toContain('env(safe-area-inset-bottom)');
  });

  it('implements scroll-direction rules in MobileAppShell and preserves immersive no-nav behavior', () => {
    const source = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
    const immersive = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'train', onNavigate: () => undefined, trainTabId: 'train', immersive: true },
        React.createElement('div', null, 'focus'),
      ),
    );

    expect(source).toContain('handleShellScroll');
    expect(source).toContain('delta > 12');
    expect(source).toContain('nearTop || nearBottom');
    expect(immersive).not.toContain('data-bottom-nav-hidden');
    expect(immersive).not.toContain('data-bottom-nav-hidden');
  });
});
