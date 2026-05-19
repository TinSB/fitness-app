import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';
import { ThemeSettingsPanel } from '../src/uiOs/settings/ThemeSettingsPanel';

const unitSettings = {
  weightUnit: 'lb' as const,
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

describe('UI-OS R7 theme regression lock', () => {
  it('resolves system and explicit themes without source-of-truth or persistence changes', () => {
    expect(resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: true })).toMatchObject({
      resolvedTheme: 'dark',
      sourceOfTruthChanged: false,
      persistenceChanged: false,
    });
    expect(resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: false }).resolvedTheme).toBe('light');
    expect(resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: true }).resolvedTheme).toBe('light');
    expect(resolveThemePreference({ selectedThemeMode: 'dark', systemPrefersDark: false }).resolvedTheme).toBe('dark');
  });

  it('keeps Focus Mode eligible for immersive dark even when app theme is light', () => {
    const result = resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: false, focusModeImmersive: true });

    expect(result.resolvedTheme).toBe('light');
    expect(result.focusModeUsesImmersiveDark).toBe(true);
    expect(result.shellThemeClass).toContain('theme-light');
    expect(result.sourceOfTruthChanged).toBe(false);
  });

  it('keeps theme selector UI-only and free of account or cloud copy', () => {
    const html = renderToStaticMarkup(
      React.createElement(ThemeSettingsPanel, {
        theme: resolveThemePreference({ selectedThemeMode: 'system' }),
        unitSettings,
        onThemeChange: () => undefined,
        onUnitChange: () => undefined,
      }),
    );

    expect(html).toContain('系统');
    expect(html).toContain('浅色');
    expect(html).toContain('深色');
    expect(html).toContain('本次界面显示');
    expect(html).toContain('不会改变训练记录');
    expect(html).not.toContain('account');
    expect(html).not.toContain('云端');
    expect(html).not.toContain('同步');
  });
});
