import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveThemeSurface } from '../src/uiOs/theme/themeSurfaceModel';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { ActionButton } from '../src/ui/ActionButton';
import { ActionButton as UiOsActionButton } from '../src/uiOs/primitives/ActionButton';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R9.1 light theme input and button contrast', () => {
  it('resolves light input surfaces with readable text and placeholders', () => {
    const surface = resolveThemeSurface('input_surface', 'light');

    expect(surface.className).toContain('bg-white');
    expect(surface.className).toContain('text-slate-950');
    expect(surface.className).toContain('placeholder:text-slate-400');
  });

  it('adds global light input placeholder overrides', () => {
    const css = read('src/index.css');

    expect(css).toContain(".uios-theme-light [data-theme-surface='input_surface']");
    expect(css).toContain('.uios-theme-light input::placeholder');
    expect(css).toContain('color: #94a3b8 !important');
  });

  it('renders shared ActionButton with light-compatible secondary and primary variants', () => {
    const secondary = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(ActionButton, { variant: 'secondary' }, '查看详情'),
      ),
    );
    const primary = renderToStaticMarkup(
      React.createElement(
        UiThemeProvider,
        { value: { selectedThemeMode: 'light', resolvedTheme: 'light', focusModeImmersiveDark: true } },
        React.createElement(ActionButton, { variant: 'primary' }, '开始训练'),
      ),
    );

    expect(secondary).toContain('data-theme-mode="light"');
    expect(secondary).toContain('text-slate-950');
    expect(primary).toContain('bg-emerald-600 text-white');
    expect(primary).toContain('data-action-variant="primary"');
  });

  it('marks UI-OS primitive buttons with semantic action surface for light CSS', () => {
    const html = renderToStaticMarkup(React.createElement(UiOsActionButton, { variant: 'secondary' }, '切换目标'));

    expect(html).toContain('data-theme-surface="action_surface"');
    expect(html).toContain('data-action-variant="secondary"');
    expect(read('src/index.css')).toContain("[data-theme-surface='action_surface']:not([data-action-variant='primary'])");
  });

  it('uses shared input surface classes in Training edit controls', () => {
    const source = read('src/features/TrainingView.tsx');

    expect(source).toContain('const inputClassName = classNames(');
    expect(source).toContain('data-theme-surface="input_surface"');
    expect(source).toContain('border-slate-200 bg-white text-slate-950 placeholder:text-slate-400');
  });
});
