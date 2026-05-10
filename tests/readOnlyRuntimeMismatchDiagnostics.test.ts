import { describe, expect, it, vi } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
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

describe('read-only runtime mismatch diagnostics', () => {
  it('reports mismatches diagnostically without writes or mutation routes', async () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    const calls: string[] = [];
    const fetchImpl: DevApiReadOnlyFetch = async (input) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      const local = handleReadMirrorRequest(data, { method: 'GET', path }).body;
      const result = path === '/sessions/summary' ? { ...local, totalHistorySessions: 999 } : local;
      return new Response(JSON.stringify({ result }));
    };

    const diagnostic = await runDevApiReadOnlyComparison({ data, config, fetchImpl });

    expect(diagnostic.status).toBe('mismatch');
    expect(diagnostic.mismatchCount).toBeGreaterThan(0);
    expect(diagnostic.checkedEndpoints.map((endpoint) => endpoint.path)).toContain('/sessions/summary');
    expect(calls).not.toEqual(expect.arrayContaining(['/sessions/start', '/data-health/repair/apply']));
    expect(JSON.stringify(data)).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps diagnostics source free of setData, saveData, backup, and repair actions', () => {
    const sources = [
      readSource('src/devApi/devApiReadOnlyComparison.ts'),
      readSource('src/devApi/DevApiReadOnlyDiagnostics.tsx'),
    ].join('\n');

    expect(sources).not.toContain('setData');
    expect(sources).not.toContain('saveData');
    expect(sources).not.toContain('repairLegacyDisplayWeights');
    expect(sources).not.toMatch(/importBackup|exportBackup|backup import|backup export/i);
  });
});
