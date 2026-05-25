import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const noop = (..._args: unknown[]) => undefined;
const navItems = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

describe('UI-OS R8.4 mobile chrome gap', () => {
  it('keeps html body root and shell safe-area dark in dark mode', () => {
    const css = read('src/index.css');
    const shell = read('src/uiOs/MobileAppShell.tsx');

    expect(css).toContain('background: #0a0a0b');
    expect(css).toContain('min-height: 100dvh');
    expect(css).not.toContain('background: #f5f5f4');
    expect(shell).toContain('data-app-chrome-background={resolvedTheme}');
    expect(shell).toContain('data-shell-bottom-background={resolvedTheme}');
    expect(shell).toContain('bg-[#0a0a0b]');
    expect(shell).toContain('pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    expect(shell).toContain('scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
  });

  it('keeps bottom nav hidden and visible states on a dark safe-area surface', () => {
    const source = read('src/uiOs/navigation/FloatingBottomNav.tsx');
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems, activeTab: 'today', onNavigate: noop, trainTabId: 'train' },
        React.createElement('main', null, 'Today'),
      ),
    );

    expect(source).toContain('data-bottom-nav-safe-area="covered"');
    expect(source).toContain('fixed bottom-0 left-0 right-0');
    expect(source).toContain('pb-[calc(0.5rem+env(safe-area-inset-bottom))]');
    expect(source).toContain("border-white/10 bg-[#1c1c1e]/88");
    expect(source).toContain("data-theme-mode={themeMode}");
    expect(html).toContain('data-bottom-nav-hidden="false"');
    expect(html).toContain('data-bottom-nav-background="dark"');
  });
});
