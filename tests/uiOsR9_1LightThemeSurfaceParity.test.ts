import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveThemeSurface } from '../src/uiOs/theme/themeSurfaceModel';
import { resolveThemeText } from '../src/uiOs/theme/themeTextModel';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { BottomSheet } from '../src/uiOs/surfaces/BottomSheet';

describe('UI-OS R9.1 light theme semantic surface parity', () => {
  it('resolves normal training and detail surfaces to light and dark variants', () => {
    for (const surface of [
      'training_hero',
      'training_detail_surface',
      'record_detail_surface',
      'input_surface',
      'action_surface',
      'bottom_sheet',
      'modal_surface',
    ] as const) {
      expect(resolveThemeSurface(surface, 'light').resolvedMode).toBe('light');
      expect(resolveThemeSurface(surface, 'light').className).not.toContain('bg-[#0a0a0b]');
      expect(resolveThemeSurface(surface, 'dark').resolvedMode).toBe('dark');
    }
  });

  it('keeps immersive Focus dark even when a light global mode is requested', () => {
    const hero = resolveThemeSurface('training_hero', 'light', { immersiveDark: true });
    const sheet = resolveThemeSurface('bottom_sheet', 'light', { immersiveDark: true });

    expect(hero.resolvedMode).toBe('dark');
    expect(sheet.resolvedMode).toBe('dark');
    expect(hero.className).toContain('bg-gradient-to-br');
  });

  it('renders semantic light cards and sheets with light mode markers', () => {
    const cardHtml = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(GlassCard, { surface: 'training_detail_surface' }, '训练详情'),
      ),
    );
    const sheetHtml = renderToStaticMarkup(
      React.createElement(BottomSheet, { isOpen: true, onClose: () => undefined, title: '重量详情', themeMode: 'light' }, '内容'),
    );

    expect(cardHtml).toContain('data-theme-mode="light"');
    expect(cardHtml).toContain('data-theme-surface="training_detail_surface"');
    expect(sheetHtml).toContain('data-theme-mode="light"');
    expect(sheetHtml).not.toContain('data-theme-mode="dark"');
  });

  it('resolves light text tokens to high contrast dark text', () => {
    expect(resolveThemeText('pageTitle', 'light').className).toContain('text-slate-950');
    expect(resolveThemeText('sectionTitle', 'light').className).toContain('text-slate-950');
    expect(resolveThemeText('primaryText', 'light').className).toContain('text-slate-950');
    expect(resolveThemeText('mutedText', 'light').className).toContain('text-slate-500');
  });
});
