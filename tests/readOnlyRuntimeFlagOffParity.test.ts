import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DevApiReadOnlyDiagnostics } from '../src/devApi/DevApiReadOnlyDiagnosticsController';
import { resolveDevApiReadOnlyConfig } from '../src/devApi/devApiReadOnlyConfig';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('read-only runtime flag-off parity', () => {
  it('renders no diagnostics and performs no fetch when the flag is off', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const config = resolveDevApiReadOnlyConfig({ DEV: true });

    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnostics, { data, config }));

    expect(markup).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps production-like env disabled even with explicit compare flag', () => {
    const config = resolveDevApiReadOnlyConfig({
      DEV: false,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    });

    expect(config).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('keeps App source limited to the guarded diagnostics mount', () => {
    const app = readSource('src/App.tsx');
    const diagnostics = readSource('src/devApi/DevApiReadOnlyDiagnostics.tsx');
    const controller = readSource('src/devApi/DevApiReadOnlyDiagnosticsController.tsx');

    expect(app.match(/\bDevApiReadOnlyDiagnostics\b/g) || []).toHaveLength(2);
    expect(app).toContain('<DevApiReadOnlyDiagnostics data={data} config={devApiReadOnlyConfig} />');
    expect(app).not.toContain('runDevApiReadOnlyComparison');
    expect(diagnostics).not.toContain('runDevApiReadOnlyComparison');
    expect(controller.indexOf('if (!config.enabled)')).toBeLessThan(controller.indexOf('void runDevApiReadOnlyComparison'));
  });
});
