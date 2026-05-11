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

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API-backed read runtime acceptance', () => {
  it('accepts only the six GET read routes and named read methods', () => {
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

  it('covers API available responses with display-only snapshot metadata', async () => {
    const fetchImpl: ApiBackedReadFetch = async (input, init) => {
      expect(init?.method).toBe('GET');
      expect(init?.headers).toEqual({ Accept: 'application/json' });
      return response({
        result: { path: new URL(String(input)).pathname, ok: true },
        snapshot: {
          snapshotId: 'snapshot-read-1',
          createdAt: '2026-05-11T00:00:00.000Z',
          schemaVersion: 1,
          label: 'read:summary',
        },
      });
    };

    const client = createApiBackedReadClient(config, fetchImpl);
    await expect(client.readHealth()).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
    await expect(client.readAppDataSummary()).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
    await expect(client.readSessionsSummary()).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
    await expect(client.readHistory()).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
    await expect(client.readHistoryDetail('session 1')).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
    await expect(client.readDataHealthSummary()).resolves.toMatchObject({ ok: true, snapshotMetadataPresent: true });
  });

  it('covers API unavailable, malformed response, timeout, and missing snapshot metadata', async () => {
    const unavailableFetch: ApiBackedReadFetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(fetchApiBackedReadPath('/health', config, { fetchImpl: unavailableFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_unavailable' },
    });

    const malformedFetch: ApiBackedReadFetch = async () => response({ notResult: true });
    await expect(fetchApiBackedReadPath('/history', config, { fetchImpl: malformedFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_invalid_response' },
    });

    const timeoutFetch: ApiBackedReadFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    await expect(fetchApiBackedReadPath('/health', { ...config, timeoutMs: 1 }, { fetchImpl: timeoutFetch })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_backed_read_timeout' },
    });

    const missingSnapshotFetch: ApiBackedReadFetch = async () => response({ result: { ok: true } });
    await expect(fetchApiBackedReadPath('/sessions/summary', config, { fetchImpl: missingSnapshotFetch })).resolves.toMatchObject({
      ok: true,
      snapshotMetadataPresent: false,
    });
  });

  it('documents snapshot mismatch, readMirror parity, and Task 5.10 as the next task', () => {
    const doc = readSource('docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md');

    for (const expected of [
      '## API Available Acceptance',
      '## API Unavailable Acceptance',
      '## Malformed Response Acceptance',
      '## Timeout and Abort Acceptance',
      '## Snapshot Mismatch Acceptance',
      '## readMirror Parity Acceptance',
      '## LocalStorage Integrity Acceptance',
      '## GET-only Boundary Acceptance',
      'Task 5.10 API-backed Read Manual App Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
