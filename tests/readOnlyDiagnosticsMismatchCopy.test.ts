import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
import { DevApiReadOnlyDiagnosticsPanel } from '../src/devApi/DevApiReadOnlyDiagnostics';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import type { DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const config = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

describe('read-only diagnostics mismatch copy', () => {
  it('shows safe mismatch copy without action controls or labels', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    const fetchImpl: DevApiReadOnlyFetch = async (input) => {
      const path = new URL(String(input)).pathname;
      const local = handleReadMirrorRequest(data, { method: 'GET', path }).body;
      return new Response(JSON.stringify({
        result: path === '/sessions/summary' ? { ...local, totalHistorySessions: 999 } : local,
      }));
    };

    const diagnostic = await runDevApiReadOnlyComparison({ data, config, fetchImpl });
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, { diagnostic }));

    expect(diagnostic.status).toBe('mismatch');
    expect(markup).toContain('Differences</dt><dd>1</dd>');
    expect(markup).toContain('/sessions/summary');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('No data was changed');
    expect(markup).not.toMatch(/<button/i);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(data)).toBe(before);
    vi.unstubAllGlobals();
  });
});
