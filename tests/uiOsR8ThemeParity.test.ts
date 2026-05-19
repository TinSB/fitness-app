import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { EquipmentAwareLoadCard } from '../src/uiOs/training/EquipmentAwareLoadCard';
import { resolveThemeSurface } from '../src/uiOs/theme/themeSurfaceModel';

describe('UI-OS R8 theme parity', () => {
  it('resolves semantic surfaces for dark and light modes without source or persistence changes', () => {
    const darkHealth = resolveThemeSurface('health_card', 'dark');
    const lightHealth = resolveThemeSurface('health_card', 'light');
    const focusHero = resolveThemeSurface('training_hero', 'light', { immersiveDark: true });

    expect(darkHealth.resolvedMode).toBe('dark');
    expect(darkHealth.className).not.toMatch(/\bbg-white\b/);
    expect(lightHealth.resolvedMode).toBe('light');
    expect(lightHealth.className).toContain('bg-white');
    expect(focusHero.resolvedMode).toBe('dark');
    expect(focusHero.sourceOfTruthChanged).toBe(false);
    expect(focusHero.persistenceChanged).toBe(false);
  });

  it('marks key UI-OS components with semantic surface tokens', () => {
    const glass = renderToStaticMarkup(React.createElement(GlassCard, { surface: 'health_card', themeMode: 'dark' }, 'health'));
    const equipment = renderToStaticMarkup(
      React.createElement(EquipmentAwareLoadCard, {
        type: 'barbell',
        mainDisplay: '45 lb',
        subInfo: '空杆',
      }),
    );

    expect(glass).toContain('data-theme-surface="health_card"');
    expect(glass).toContain('data-theme-mode="dark"');
    expect(equipment).toContain('data-theme-surface="training_hero"');
    expect(equipment).toContain('45 lb');
  });

  it('keeps dark training flow away from uncontrolled white-card patterns', () => {
    const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');
    const trainingSurfaceSource = readFileSync('src/uiOs/training/TrainingOsCards.tsx', 'utf8');

    expect(focusSource).toContain('data-focus-actual-form-visible="false"');
    expect(trainingSurfaceSource).toContain('surface="training_hero"');
    expect(focusSource).not.toContain('ActualSetInputCard');
    expect(focusSource).not.toMatch(/<Card className="[^"]*bg-white text-slate-950/);
  });
});
