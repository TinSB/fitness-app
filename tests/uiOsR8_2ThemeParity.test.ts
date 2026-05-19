import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { SettingsGroupCard } from '../src/uiOs/settings/SettingsGroupCard';
import { resolveThemeSurface } from '../src/uiOs/theme/themeSurfaceModel';

describe('UI-OS R8.2 theme surface parity', () => {
  it('resolves new compact and dark glass surfaces without raw dark-path white cards', () => {
    const darkGlass = resolveThemeSurface('dark_glass_card', 'dark');
    const compactDark = resolveThemeSurface('compact_row', 'dark');
    const settingsDark = resolveThemeSurface('settings_group', 'dark');
    const healthDark = resolveThemeSurface('health_card', 'dark');
    const healthLight = resolveThemeSurface('health_card', 'light');
    const focusHero = resolveThemeSurface('training_hero', 'light', { immersiveDark: true });

    expect(darkGlass.resolvedMode).toBe('dark');
    expect(compactDark.className).not.toMatch(/\bbg-white(?:\s|$)/);
    expect(settingsDark.className).not.toMatch(/\bbg-white(?:\s|$)/);
    expect(healthDark.className).not.toMatch(/\bbg-white(?:\s|$)/);
    expect(healthLight.className).toContain('bg-white');
    expect(focusHero.resolvedMode).toBe('dark');
    expect(focusHero.sourceOfTruthChanged).toBe(false);
    expect(focusHero.persistenceChanged).toBe(false);
  });

  it('marks grouped settings and key cards with semantic surface tokens', () => {
    const settings = renderToStaticMarkup(React.createElement(SettingsGroupCard, null, '设置'));
    const compact = renderToStaticMarkup(React.createElement(GlassCard, { surface: 'compact_row', themeMode: 'dark' }, 'row'));

    expect(settings).toContain('data-theme-surface="settings_group"');
    expect(settings).toContain('data-theme-mode="dark"');
    expect(compact).toContain('data-theme-surface="compact_row"');
  });
});
