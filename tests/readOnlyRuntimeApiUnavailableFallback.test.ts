import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DevApiReadOnlyDiagnosticsPanel } from '../src/devApi/DevApiReadOnlyDiagnostics';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import type { DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const config = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 2,
} as const;

describe('read-only runtime API unavailable fallback', () => {
  it('turns network failure into unavailable diagnostics without mutating data or localStorage', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    const fetchImpl: DevApiReadOnlyFetch = async () => {
      throw new TypeError('fetch failed');
    };

    const diagnostic = await runDevApiReadOnlyComparison({ data, config, fetchImpl });

    expect(diagnostic.status).toBe('unavailable');
    expect(diagnostic.message).toContain('App remains on localStorage');
    expect(JSON.stringify(data)).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('turns timeout into unavailable diagnostics and renders no mutation controls', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const fetchImpl: DevApiReadOnlyFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });

    const diagnostic = await runDevApiReadOnlyComparison({ data, config, fetchImpl });
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, { diagnostic }));

    expect(diagnostic.status).toBe('unavailable');
    expect(markup).toContain('unavailable');
    expect(markup).not.toMatch(/<button/i);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });
});
