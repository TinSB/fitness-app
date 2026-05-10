import { describe, expect, it, vi } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
import type { AppData } from '../src/models/training-model';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import type { DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

const config = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const readMirrorFetch = (data: AppData, overrides: Record<string, unknown> = {}): DevApiReadOnlyFetch => async (input) => {
  const path = new URL(String(input)).pathname;
  const body = path in overrides ? overrides[path] : handleReadMirrorRequest(data, { method: 'GET', path }).body;
  return response({ result: body });
};

describe('dev API read-only comparison', () => {
  it('reports matching when local readMirror and Dev API results match', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const result = await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: readMirrorFetch(data),
      now: () => '2026-05-10T00:00:00.000Z',
    });

    expect(result.status).toBe('matching');
    expect(result.mismatchCount).toBe(0);
    expect(result.checkedEndpoints.map((endpoint) => endpoint.path)).toEqual([
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      `/history/${encodeURIComponent(data.history[0].id)}`,
      '/data-health/summary',
    ]);
  });

  it('reports mismatch diagnostically without mutating AppData or localStorage', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });

    const result = await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: readMirrorFetch(data, {
        '/app-data/summary': { schemaVersion: data.schemaVersion, templateCount: 999 },
      }),
    });

    expect(result.status).toBe('mismatch');
    expect(result.mismatchCount).toBe(1);
    expect(JSON.stringify(data)).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reports unavailable diagnostics without blocking comparison callers', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const unavailableFetch: DevApiReadOnlyFetch = async () => {
      throw new TypeError('fetch failed');
    };

    const result = await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: unavailableFetch,
    });

    expect(result.status).toBe('unavailable');
    expect(result.checkedEndpoints.every((endpoint) => endpoint.status === 'unavailable')).toBe(true);
  });

  it('marks history detail as skipped when there is no stable local history id', async () => {
    const data = { ...buildAppDataFromFixture('legacy-assisted-pullup-session'), history: [] };
    const result = await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: readMirrorFetch(data),
    });

    expect(result.checkedEndpoints.map((endpoint) => endpoint.path)).toEqual([
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);
    expect(result.checkedEndpoints.find((endpoint) => endpoint.path === '/history/:id')).toMatchObject({
      status: 'skipped',
      reason: expect.any(String),
    });
  });

  it('uses existing readMirror helpers instead of duplicating summary business logic', () => {
    const source = readSource('src/devApi/devApiReadOnlyComparison.ts');

    expect(source).toContain('handleReadMirrorRequest');
    expect(source).not.toContain('templateCount:');
    expect(source).not.toContain('analyticsSessionCount:');
    expect(source).not.toContain('buildDataHealthReport');
  });
});
