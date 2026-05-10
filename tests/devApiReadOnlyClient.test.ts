import { describe, expect, it } from 'vitest';
import type { DevApiReadOnlyEnabledConfig } from '../src/devApi/devApiReadOnlyConfig';
import {
  DEV_API_READ_ONLY_ROUTES,
  createDevApiReadOnlyClient,
  fetchDevApiReadOnlyPath,
  type DevApiReadOnlyFetch,
} from '../src/devApi/devApiReadOnlyClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiReadOnlyEnabledConfig = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('dev API read-only client', () => {
  it('declares only read-only routes and exposes no mutation methods', () => {
    expect(DEV_API_READ_ONLY_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);
    expect(Object.keys(createDevApiReadOnlyClient(config)).sort()).toEqual([
      'readAppDataSummary',
      'readDataHealthSummary',
      'readHealth',
      'readHistory',
      'readHistoryDetail',
      'readSessionsSummary',
    ]);
  });

  it('validates success and server error response shapes', async () => {
    const successFetch: DevApiReadOnlyFetch = async () => jsonResponse({ result: { ok: true }, snapshot: { snapshotId: 's1' } });
    await expect(fetchDevApiReadOnlyPath('/health', config, { fetchImpl: successFetch })).resolves.toMatchObject({
      ok: true,
      status: 200,
      result: { ok: true },
      snapshot: { snapshotId: 's1' },
    });

    const errorFetch: DevApiReadOnlyFetch = async () =>
      jsonResponse({ error: { code: 'snapshot_not_found', message: 'Missing snapshot' } }, 404);
    await expect(fetchDevApiReadOnlyPath('/app-data/summary', config, { fetchImpl: errorFetch })).resolves.toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'dev_api_error_response', serverCode: 'snapshot_not_found' },
    });
  });

  it('normalizes unavailable, timeout, and malformed responses', async () => {
    const unavailableFetch: DevApiReadOnlyFetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(fetchDevApiReadOnlyPath('/health', config, { fetchImpl: unavailableFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_api_unavailable' },
    });

    const timeoutFetch: DevApiReadOnlyFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    await expect(fetchDevApiReadOnlyPath('/health', { ...config, timeoutMs: 1 }, { fetchImpl: timeoutFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_api_timeout' },
    });

    const malformedFetch: DevApiReadOnlyFetch = async () => jsonResponse({ notResult: true });
    await expect(fetchDevApiReadOnlyPath('/health', config, { fetchImpl: malformedFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_api_invalid_response' },
    });
  });

  it('supports external cancellation with AbortController', async () => {
    const controller = new AbortController();
    const pendingFetch: DevApiReadOnlyFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const promise = fetchDevApiReadOnlyPath('/health', config, {
      fetchImpl: pendingFetch,
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_api_unavailable' },
    });
  });

  it('keeps the client browser-safe and read-only by static source inspection', () => {
    const source = readSource('src/devApi/devApiReadOnlyClient.ts');

    expect(source).not.toMatch(/\bPOST\b|\/sessions\/start|\/history\/:id\/edit|\/data-health\/repair|backup|reset|repair/i);
    expect(source).not.toContain('saveData');
    expect(source).not.toContain('loadData');
    expect(source).not.toContain('localStorageAdapter');
    expect(source).not.toContain('node:http');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('serverAdapter');
    expect(source).not.toContain('sqliteRepository');
  });
});
