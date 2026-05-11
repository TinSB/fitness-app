import { describe, expect, it, vi } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
import { fetchApiBackedReadPath, type ApiBackedReadFetch } from '../src/devApi/apiBackedReadClient';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

const config = {
  enabled: true,
  status: 'enabled',
  runtimeSource: 'api-readonly',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('API-backed read runtime localStorage integrity', () => {
  it('does not write localStorage or mutate AppData when API results differ from local readMirror summaries', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);
    const setItem = vi.fn();
    const getItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });

    const localSummary = handleReadMirrorRequest(data, { method: 'GET', path: '/app-data/summary' }).body;
    const apiSummary = { ...(localSummary as Record<string, unknown>), historyCount: 999 };
    const fetchImpl: ApiBackedReadFetch = async () => response({ result: apiSummary });

    const result = await fetchApiBackedReadPath('/app-data/summary', config, { fetchImpl });

    expect(result).toMatchObject({ ok: true, snapshotMetadataPresent: false });
    expect(JSON.stringify(data)).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps API-backed read files free of persistence entry points', () => {
    const combined = [
      'src/devApi/apiBackedReadConfig.ts',
      'src/devApi/apiBackedReadClient.ts',
      'src/devApi/ApiBackedReadDiagnostics.tsx',
    ].map(readSource).join('\n');

    expect(combined).not.toContain('saveData');
    expect(combined).not.toContain('loadData');
    expect(combined).not.toContain('localStorageAdapter');
    expect(combined).not.toContain('setData(');
    expect(combined).not.toContain('setItem(');
  });
});
