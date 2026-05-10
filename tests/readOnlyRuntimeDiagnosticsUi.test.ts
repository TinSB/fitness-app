import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DevApiReadOnlyDiagnostics,
  DevApiReadOnlyDiagnosticsPanel,
} from '../src/devApi/DevApiReadOnlyDiagnostics';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

describe('read-only runtime diagnostics UI safety', () => {
  it('renders null when disabled', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');

    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnostics, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'flag_off' },
    }));

    expect(markup).toBe('');
  });

  it('shows only minimal diagnostic status fields when enabled', () => {
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, {
      diagnostic: {
        status: 'mismatch',
        checkedAt: '2026-05-10T00:00:00.000Z',
        checkedEndpoints: [
          { path: '/app-data/summary', status: 'matching' },
          { path: '/sessions/summary', status: 'mismatch' },
        ],
        mismatchCount: 1,
        message: 'Dev API read-only comparison found diagnostic mismatches.',
      },
    }));

    expect(markup).toContain('Dev API read-only diagnostics');
    expect(markup).toContain('status:');
    expect(markup).toContain('checked endpoints:');
    expect(markup).toContain('mismatches:');
    expect(markup).toContain('last checked:');
    expect(markup).not.toMatch(/<button/i);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });
});
