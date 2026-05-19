import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { FloatingBottomNav } from '../src/uiOs/navigation/FloatingBottomNav';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

describe('UI-OS R9.1 bottom nav chrome', () => {
  it('renders bottom nav with native safe-area offset instead of an oversized dead-zone spacer', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingBottomNav, {
        items,
        activeId: 'today',
        onNavigate: () => undefined,
        trainTabId: 'train',
      }),
    );

    expect(html).toContain('data-bottom-nav-safe-area="native-offset"');
    expect(html).toContain('bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]');
    expect(html).not.toContain('pb-[calc(2rem+env(safe-area-inset-bottom))]');
    expect(html).not.toContain('bg-[linear-gradient(to_top,#0a0a0b');
  });

  it('keeps scroll padding for nav clearance without rendering a fixed footer filler', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        {
          navItems: items,
          activeTab: 'today',
          onNavigate: () => undefined,
          trainTabId: 'train',
          themePreference: resolveThemePreference({ selectedThemeMode: 'dark', systemPrefersDark: true }),
        },
        React.createElement('main', null, 'Today'),
      ),
    );

    expect(html).toContain('data-shell-bottom-reserve="nav-clearance-only"');
    expect(html).toContain('pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    expect(html).toContain('scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    expect(html).not.toContain('pb-[calc(9rem+env(safe-area-inset-bottom))]');
  });

  it('does not leave a black dead zone when the nav auto-hide state is hidden', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingBottomNav, {
        items,
        activeId: 'history',
        onNavigate: () => undefined,
        trainTabId: 'train',
        hidden: true,
        themeMode: 'light',
      }),
    );

    expect(html).toContain('data-bottom-nav-hidden="true"');
    expect(html).toContain('translate-y-[calc(100%+1rem+env(safe-area-inset-bottom))]');
    expect(html).toContain('data-bottom-nav-background="light"');
    expect(html).not.toContain('bg-[#0a0a0b]');
  });

  it('keeps Focus immersive mode free of the global bottom nav', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'train', onNavigate: () => undefined, trainTabId: 'train', immersive: true },
        React.createElement('main', null, 'Focus'),
      ),
    );

    expect(html).toContain('data-shell-safe-bottom="immersive"');
    expect(html).not.toContain('data-bottom-nav-hidden');
  });

  it('locks the shell and nav source away from the old oversized mobile chrome', () => {
    const shell = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
    const nav = readFileSync('src/uiOs/navigation/FloatingBottomNav.tsx', 'utf8');

    expect(shell).toContain('data-shell-bottom-reserve');
    expect(shell).not.toContain('pb-[calc(9rem+env(safe-area-inset-bottom))]');
    expect(nav).not.toContain('bottom-0 left-0 right-0 bg-[linear-gradient');
    expect(nav).not.toContain('pb-[calc(2rem+env(safe-area-inset-bottom))]');
  });
});
