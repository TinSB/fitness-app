import { describe, expect, it } from 'vitest';
import type { ApiBackedReadEnabledConfig } from '../src/devApi/apiBackedReadConfig';
import {
  API_BACKED_READ_ROUTES,
  createApiBackedReadClient,
  fetchApiBackedReadPath,
  type ApiBackedReadFetch,
} from '../src/devApi/apiBackedReadClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: ApiBackedReadEnabledConfig = {
  enabled: true,
  status: 'enabled',
  runtimeSource: 'api-readonly',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API-backed read client', () => {
  it('declares only allowed GET routes and exposes named read methods', () => {
    expect(API_BACKED_READ_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);

    expect(Object.keys(createApiBackedReadClient(config)).sort()).toEqual([
      'readAppDataSummary',
      'readDataHealthSummary',
      'readHealth',
      'readHistory',
      'readHistoryDetail',
      'readSessionsSummary',
    ]);
  });

  it('sends GET only and preserves safe snapshot metadata as display-only data', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const successFetch: ApiBackedReadFetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({
        result: { historyCount: 2 },
        snapshot: {
          snapshotId: 'snapshot-1',
          createdAt: '2026-05-10T00:00:00.000Z',
          schemaVersion: 1,
        },
      });
    };

    await expect(fetchApiBackedReadPath('/app-data/summary', config, { fetchImpl: successFetch })).resolves.toMatchObject({
      ok: true,
      status: 200,
      result: { historyCount: 2 },
      snapshotMetadataPresent: true,
      snapshot: { snapshotId: 'snapshot-1' },
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe('http://127.0.0.1:8787/app-data/summary');
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('treats missing snapshot metadata as visible metadata absence, not fake source-of-truth success', async () => {
    const readFetch: ApiBackedReadFetch = async () => jsonResponse({ result: { ok: true } });
    await expect(fetchApiBackedReadPath('/health', config, { fetchImpl: readFetch })).resolves.toMatchObject({
      ok: true,
      result: { ok: true },
      snapshotMetadataPresent: false,
    });
  });

  it('normalizes route, server, malformed, unavailable, timeout, and abort failures', async () => {
    const routeResult = await fetchApiBackedReadPath('/sessions/start' as never, config, {
      fetchImpl: async () => jsonResponse({ result: {} }),
    });
    expect(routeResult).toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_route_not_allowed' },
    });

    const errorFetch: ApiBackedReadFetch = async () =>
      jsonResponse({ error: { code: 'snapshot_not_found', message: 'Missing snapshot' } }, 404);
    await expect(fetchApiBackedReadPath('/history', config, { fetchImpl: errorFetch })).resolves.toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'api_backed_read_error_response', serverCode: 'snapshot_not_found' },
    });

    const malformedFetch: ApiBackedReadFetch = async () => jsonResponse({ notResult: true });
    await expect(fetchApiBackedReadPath('/history', config, { fetchImpl: malformedFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_invalid_response' },
    });

    const unavailableFetch: ApiBackedReadFetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(fetchApiBackedReadPath('/health', config, { fetchImpl: unavailableFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_unavailable' },
    });

    const timeoutFetch: ApiBackedReadFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    await expect(fetchApiBackedReadPath('/health', { ...config, timeoutMs: 1 }, { fetchImpl: timeoutFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_timeout' },
    });

    const controller = new AbortController();
    const promise = fetchApiBackedReadPath('/health', config, {
      fetchImpl: timeoutFetch,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_unavailable' },
    });
  });

  it('keeps the client browser-safe, GET-only, and source-of-truth neutral by static source inspection', () => {
    const source = readSource('src/devApi/apiBackedReadClient.ts');

    expect(source).not.toMatch(/\bPOST\b|\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/data-health\/repair|backup|reset|repair/i);
    expect(source).not.toContain('saveData');
    expect(source).not.toContain('loadData');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('localStorageAdapter');
    expect(source).not.toContain('node:http');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('serverAdapter');
    expect(source).not.toContain('sqliteRepository');
  });
});
