import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DevApiReadOnlyDiagnostics } from '../src/devApi/DevApiReadOnlyDiagnosticsController';
import { createDevApiMisconfiguredDiagnostic, DevApiReadOnlyDiagnosticsPanel } from '../src/devApi/DevApiReadOnlyDiagnostics';
import { resolveDevApiReadOnlyConfig } from '../src/devApi/devApiReadOnlyConfig';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

describe('read-only diagnostics misconfiguration copy', () => {
  it('renders safe localhost-only diagnostics for non-localhost base URL without fetching', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const config = resolveDevApiReadOnlyConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://api.example.com',
    });

    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnostics, { data, config }));

    expect(markup).toContain('Misconfigured');
    expect(markup).toContain('localhost');
    expect(markup).not.toContain('https://api.example.com');
    expect(markup).not.toContain('VITE_IRONPATH_DEV_API_BASE_URL');
    expect(markup).not.toMatch(/production URL|production server/i);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not expose raw env-like diagnostic text', () => {
    const diagnostic = createDevApiMisconfiguredDiagnostic(
      '{"VITE_IRONPATH_DEV_API_BASE_URL":"https://api.example.com","token":"secret"}',
    );
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, { diagnostic }));

    expect(markup).toContain('Dev API comparison config is invalid.');
    expect(markup).not.toContain('token');
    expect(markup).not.toContain('secret');
    expect(markup).not.toContain('https://api.example.com');
  });
});
