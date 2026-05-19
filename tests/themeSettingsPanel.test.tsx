import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';
import { ThemeSettingsPanel } from '../src/uiOs/settings/ThemeSettingsPanel';
import type { UnitSettings } from '../src/models/training-model';

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('ThemeSettingsPanel', () => {
  it('renders system light dark selector and units', () => {
    const markup = renderToStaticMarkup(
      <ThemeSettingsPanel
        theme={resolveThemePreference({ selectedThemeMode: 'system' })}
        unitSettings={unitSettings}
        onThemeChange={vi.fn()}
        onUnitChange={vi.fn()}
      />,
    );
    const visible = text(markup);

    expect(visible).toContain('App Preferences');
    expect(visible).toContain('系统');
    expect(visible).toContain('浅色');
    expect(visible).toContain('深色');
    expect(visible).toContain('kg 公斤');
    expect(visible).toContain('lb 磅');
    expect(visible).toContain('Focus Mode 会保持沉浸深色');
    expect(visible).toContain('不会改变训练记录');
  });
});
