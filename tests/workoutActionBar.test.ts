import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionButton } from '../src/ui/ActionButton';
import { WorkoutActionBar } from '../src/ui/WorkoutActionBar';

const renderActionBarHtml = () =>
  renderToStaticMarkup(
    React.createElement(
      WorkoutActionBar,
      null,
      React.createElement(
        'div',
        { className: 'grid gap-2' },
        React.createElement(
          'div',
          { className: 'grid grid-cols-3 gap-2' },
          React.createElement('button', { type: 'button', 'aria-label': '复制上组', disabled: true }, '复制上组'),
          React.createElement('button', { type: 'button', 'aria-label': '标记不适' }, '标记不适'),
          React.createElement('button', { type: 'button', 'aria-label': '替代动作' }, '替代动作'),
        ),
        React.createElement(
          ActionButton,
          { type: 'button', 'aria-label': '完成一组', variant: 'primary', size: 'lg', fullWidth: true },
          '完成一组',
        ),
      ),
    ),
  );

describe('WorkoutActionBar focus actions', () => {
  it('renders every required action label instead of icon-only buttons', () => {
    const html = renderActionBarHtml();

    expect(html).toContain('复制上组');
    expect(html).toContain('标记不适');
    expect(html).toContain('替代动作');
    expect(html).toContain('完成一组');
  });

  it('keeps the replacement action accessible', () => {
    expect(renderActionBarHtml()).toContain('aria-label="替代动作"');
  });

  it('does not hide sibling actions when one action is disabled', () => {
    const html = renderActionBarHtml();

    expect(html).toContain('disabled=""');
    expect(html).toContain('标记不适');
    expect(html).toContain('替代动作');
    expect(html).toContain('完成一组');
  });

  it('keeps safe-area padding and clear disabled styling in the shared controls', () => {
    const barSource = readFileSync(resolve(process.cwd(), 'src/ui/WorkoutActionBar.tsx'), 'utf8');
    const buttonSource = readFileSync(resolve(process.cwd(), 'src/ui/ActionButton.tsx'), 'utf8');

    expect(barSource).toContain('env(safe-area-inset-bottom)');
    expect(barSource).toContain('bg-white');
    expect(buttonSource).toContain('disabled:text-slate-400');
    expect(buttonSource).not.toContain('disabled:opacity-50');
  });
});
