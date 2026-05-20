import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { EquipmentAwareLoadCard } from '../src/uiOs/training/EquipmentAwareLoadCard';
import { EquipmentAwareRecommendationWeight } from '../src/ui/EquipmentAwareRecommendationWeight';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R9.1 Training light theme parity', () => {
  it('marks normal Training root as theme-driven instead of hard-coded dark', () => {
    const source = read('src/features/TrainingView.tsx');

    expect(source).toContain('useUiTheme');
    expect(source).toContain('data-training-detail-surface={resolvedTheme}');
    expect(source).toContain('data-theme-surface="training_detail_surface"');
    expect(source).toContain("isDarkTheme ? trainingDarkDescendantOverrides : ''");
    expect(source).not.toContain('data-training-detail-surface="dark"');
  });

  it('renders EquipmentAwareLoadCard as a light training surface in normal light theme', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(EquipmentAwareLoadCard, {
          type: 'plate-loaded',
          mainDisplay: '加重 30 lb',
          reps: 10,
          subInfo: '每边 15 lb',
        }),
      ),
    );

    expect(html).toContain('data-theme-surface="training_hero"');
    expect(html).toContain('data-theme-mode="light"');
    expect(html).toContain('加重 30 lb × 10');
    expect(html).toContain('text-slate-950');
    expect(html).not.toContain('data-theme-mode="dark"');
  });

  it('keeps EquipmentAwareLoadCard immersive dark when the Focus shell provides dark context', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
        React.createElement(EquipmentAwareLoadCard, { type: 'barbell', mainDisplay: '空杆 45 lb', reps: 10 }),
      ),
    );

    expect(html).toContain('data-theme-mode="dark"');
    expect(html).toContain('空杆 45 lb × 10');
    expect(html).toContain('text-white');
  });

  it('renders old recommendation wrapper with light compact surfaces and dark readable text', () => {
    const unitSettings = {
      weightUnit: 'lb' as const,
      defaultIncrementKg: 2.5,
      defaultIncrementLb: 5,
      customIncrementsKg: [],
      customIncrementsLb: [],
    };
    const html = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(EquipmentAwareRecommendationWeight, {
          exerciseName: 'bench_press',
          plannedWeightKg: 12.25,
          setPurpose: 'warmup',
          unitSettings,
          reps: 10,
          showDetails: true,
          label: '本组建议',
        }),
      ),
    );

    expect(html).toContain('data-theme-surface="compact_row"');
    expect(html).toContain('data-theme-mode="light"');
    expect(html).toContain('text-slate-950');
  });
});
