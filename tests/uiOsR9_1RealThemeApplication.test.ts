import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { ThemeSettingsPanel } from '../src/uiOs/settings/ThemeSettingsPanel';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { resolveThemeSurface } from '../src/uiOs/theme/themeSurfaceModel';

const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));
const unitSettings = {
  weightUnit: 'lb' as const,
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

describe('UI-OS R9.1 real theme application', () => {
  it('applies light theme visibly to shell surfaces and bottom nav', () => {
    const lightPreference = resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: true });
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        {
          navItems: items,
          activeTab: 'today',
          onNavigate: () => undefined,
          trainTabId: 'train',
          themePreference: lightPreference,
        },
        React.createElement('main', null, 'Today'),
      ),
    );

    expect(html).toContain('data-ui-theme="light"');
    expect(html).toContain('data-app-chrome-background="light"');
    expect(html).toContain('bg-slate-50 text-slate-950');
    expect(html).toContain('data-bottom-nav-background="light"');
    expect(html).toContain('data-bottom-nav-chrome="safe-area-capsule"');
    expect(html).toContain('bg-white/90');
    expect(html).not.toContain('data-bottom-nav-chrome="transparent-icons"');
  });

  it('applies dark theme visibly to shell surfaces and bottom nav', () => {
    const darkPreference = resolveThemePreference({ selectedThemeMode: 'dark', systemPrefersDark: false });
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        {
          navItems: items,
          activeTab: 'history',
          onNavigate: () => undefined,
          trainTabId: 'train',
          themePreference: darkPreference,
        },
        React.createElement('main', null, 'History'),
      ),
    );

    expect(html).toContain('data-ui-theme="dark"');
    expect(html).toContain('data-app-chrome-background="dark"');
    expect(html).toContain('bg-[#0a0a0b] text-slate-100');
    expect(html).toContain('data-bottom-nav-background="dark"');
    expect(html).toContain('data-bottom-nav-chrome="safe-area-capsule"');
    expect(html).toContain('bg-[#1c1c1e]/88');
    expect(html).not.toContain('data-bottom-nav-chrome="transparent-icons"');
  });

  it('resolves system theme from system preference', () => {
    expect(resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: false }).resolvedTheme).toBe('light');
    expect(resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: true }).resolvedTheme).toBe('dark');
  });

  it('lets semantic cards consume the active light theme from context', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(GlassCard, { surface: 'health_card' }, '健康卡片'),
      ),
    );

    expect(html).toContain('data-theme-surface="health_card"');
    expect(html).toContain('data-theme-mode="light"');
    expect(html).toContain('bg-white');
  });

  it('keeps Focus eligible for immersive dark even when app theme is light', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        {
          navItems: items,
          activeTab: 'train',
          onNavigate: () => undefined,
          trainTabId: 'train',
          immersive: true,
          themePreference: resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: false }),
        },
        React.createElement(GlassCard, { surface: 'training_hero' }, 'Focus'),
      ),
    );

    expect(html).toContain('data-ui-theme="dark"');
    expect(html).toContain('data-shell-safe-bottom="immersive"');
    expect(html).not.toContain('data-bottom-nav-hidden');
  });

  it('wires the Settings theme selector to the app-level theme change handler', () => {
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const profileSource = readFileSync('src/features/ProfileView.tsx', 'utf8');
    const panelHtml = renderToStaticMarkup(
      React.createElement(ThemeSettingsPanel, {
        theme: resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: false }),
        unitSettings,
        onThemeChange: () => undefined,
        onUnitChange: () => undefined,
      }),
    );

    expect(appSource).toContain('themePreference={themePreference}');
    expect(appSource).toContain('onThemeChange={updateUiThemeMode}');
    expect(profileSource).toContain('themePreference?: ThemePreferenceResult');
    expect(panelHtml).toContain('aria-selected="true"');
    expect(panelHtml).toContain('浅色');
  });

  it('keeps semantic surface resolver light and dark variants available', () => {
    expect(resolveThemeSurface('app_background', 'light').className).toContain('bg-slate-50');
    expect(resolveThemeSurface('app_background', 'dark').className).toContain('bg-[#0a0a0b]');
    expect(resolveThemeSurface('bottom_sheet', 'light').resolvedMode).toBe('light');
    expect(resolveThemeSurface('bottom_sheet', 'dark').resolvedMode).toBe('dark');
  });
});
