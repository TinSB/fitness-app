import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DevApiReadOnlyDiagnostics,
  DevApiReadOnlyDiagnosticsPanel,
} from '../src/devApi/DevApiReadOnlyDiagnostics';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import type { DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

describe('dev API read-only App integration', () => {
  it('renders nothing when disabled', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const markup = renderToStaticMarkup(
      createElement(DevApiReadOnlyDiagnostics, {
        data,
        config: { enabled: false, status: 'disabled', reason: 'flag_off' },
      }),
    );

    expect(markup).toBe('');
  });

  it('uses GET-only comparison behavior when enabled', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const methods: Array<string | undefined> = [];
    const fetchImpl: DevApiReadOnlyFetch = async (_input, init) => {
      methods.push(init?.method);
      return new Response(JSON.stringify({ result: {} }));
    };

    await runDevApiReadOnlyComparison({ data, config: enabledConfig, fetchImpl });

    expect(new Set(methods)).toEqual(new Set(['GET']));
  });

  it('supports cancellation for in-flight diagnostics', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const controller = new AbortController();
    const fetchImpl: DevApiReadOnlyFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const pending = runDevApiReadOnlyComparison({
      data,
      config: enabledConfig,
      fetchImpl,
      signal: controller.signal,
    });

    controller.abort();

    await expect(pending).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('keeps diagnostics UI free of mutation controls', () => {
    const markup = renderToStaticMarkup(
      createElement(DevApiReadOnlyDiagnosticsPanel, {
        diagnostic: {
          status: 'mismatch',
          checkedAt: '2026-05-10T00:00:00.000Z',
          checkedEndpoints: [{ path: '/app-data/summary', status: 'mismatch' }],
          mismatchCount: 1,
          message: 'diagnostic mismatch',
        },
      }),
    );

    expect(markup).toContain('Dev API read-only diagnostics');
    expect(markup).not.toMatch(/<button|repair|sync|overwrite|import|export|reset|mutation/i);
  });

  it('mounts diagnostics in App without adding data mutation wiring', () => {
    const app = readSource('src/App.tsx');
    const diagnostics = readSource('src/devApi/DevApiReadOnlyDiagnostics.tsx');

    expect(app).toContain('<DevApiReadOnlyDiagnostics data={data} config={devApiReadOnlyConfig} />');
    expect(diagnostics).not.toContain('setData');
    expect(diagnostics).not.toContain('saveData');
    expect(diagnostics).not.toContain('loadData');
    expect(diagnostics).not.toContain('localStorageAdapter');
  });
});
