import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
import { DevApiReadOnlyDiagnostics } from '../src/devApi/DevApiReadOnlyDiagnosticsController';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import type { DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const config = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

const stubStorage = () => {
  const store = new Map<string, string>([['ironpath:data', 'original']]);
  const storage = {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
  vi.stubGlobal('localStorage', storage);
  return {
    storage,
    snapshot: () => JSON.stringify([...store.entries()]),
  };
};

const matchingFetch = (data: ReturnType<typeof buildAppDataFromFixture>): DevApiReadOnlyFetch => async (input) => {
  const path = new URL(String(input)).pathname;
  return new Response(JSON.stringify({
    result: handleReadMirrorRequest(data, { method: 'GET', path }).body,
    snapshot: { snapshotId: 'ignored-snapshot', createdAt: '2026-05-10T00:00:00.000Z' },
  }));
};

describe('read-only runtime localStorage integrity', () => {
  it('does not write localStorage when diagnostics are disabled', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const { storage, snapshot } = stubStorage();
    const before = snapshot();

    renderToStaticMarkup(createElement(DevApiReadOnlyDiagnostics, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'flag_off' },
    }));

    expect(snapshot()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not write localStorage for matching, mismatch, unavailable, or snapshot metadata responses', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const beforeData = JSON.stringify(data);
    const { storage, snapshot } = stubStorage();
    const beforeStorage = snapshot();

    await runDevApiReadOnlyComparison({ data, config, fetchImpl: matchingFetch(data) });
    await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: async (input) => {
        const path = new URL(String(input)).pathname;
        const local = handleReadMirrorRequest(data, { method: 'GET', path }).body;
        return new Response(JSON.stringify({ result: path === '/app-data/summary' ? { ...local, historyCount: 999 } : local }));
      },
    });
    await runDevApiReadOnlyComparison({
      data,
      config,
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });

    expect(snapshot()).toBe(beforeStorage);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    expect(JSON.stringify(data)).toBe(beforeData);
    vi.unstubAllGlobals();
  });
});
