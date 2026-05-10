import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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

describe('read-only diagnostics unavailable copy', () => {
  it('states the app continues on localStorage without fatal or action wording', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const fetchImpl: DevApiReadOnlyFetch = async () => {
      throw new TypeError('fetch failed');
    };

    const diagnostic = await runDevApiReadOnlyComparison({ data, config, fetchImpl });
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, { diagnostic }));

    expect(diagnostic.status).toBe('unavailable');
    expect(markup).toContain('Dev API unavailable');
    expect(markup).toContain('App continues using localStorage');
    expect(markup).toMatch(/unavailable|skipped/i);
    expect(markup).not.toMatch(/\b(fatal|blocked|cannot use|stop training)\b/i);
    expect(markup).not.toMatch(/<button/i);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });
});
