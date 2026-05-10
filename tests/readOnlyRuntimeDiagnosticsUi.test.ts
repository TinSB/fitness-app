import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DevApiReadOnlyDiagnosticsPanel,
} from '../src/devApi/DevApiReadOnlyDiagnostics';
import { DevApiReadOnlyDiagnostics } from '../src/devApi/DevApiReadOnlyDiagnosticsController';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

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
    expect(markup).toContain('Status');
    expect(markup).toContain('Endpoints');
    expect(markup).toContain('Differences');
    expect(markup).toContain('Last checked');
    expect(markup).not.toMatch(/<button/i);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });

  it('keeps the diagnostics TSX file presentational only', () => {
    const source = readSource('src/devApi/DevApiReadOnlyDiagnostics.tsx');

    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('runDevApiReadOnlyComparison');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('globalThis.fetch');
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toContain('saveData');
    expect(source).not.toContain('loadData');
    expect(source).not.toContain('node:http');
    expect(source).not.toContain('node:sqlite');
  });
});
