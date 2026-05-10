import { describe, expect, it } from 'vitest';
import { createDevApiReadOnlyClient, type DevApiReadOnlyFetch } from '../src/devApi/devApiReadOnlyClient';
import { runDevApiReadOnlyComparison } from '../src/devApi/devApiReadOnlyComparison';
import { handleReadMirrorRequest } from '../apps/api/src';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { readSource } from './runtimeBoundaryTestHelpers';

const config = {
  enabled: true,
  status: 'enabled',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
} as const;

describe('read-only runtime GET-only proof', () => {
  it('uses only GET calls against the read-only route allowlist', async () => {
    const calls: Array<{ method?: string; path: string }> = [];
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const fetchImpl: DevApiReadOnlyFetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push({ method: init?.method, path });
      return new Response(JSON.stringify({ result: handleReadMirrorRequest(data, { method: 'GET', path }).body }));
    };
    const client = createDevApiReadOnlyClient(config, fetchImpl);

    await client.readHealth();
    await runDevApiReadOnlyComparison({ data, config, fetchImpl });

    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    expect(calls.map((call) => call.path)).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      `/history/${encodeURIComponent(data.history[0].id)}`,
      '/data-health/summary',
    ]);
  });

  it('keeps the frontend client free of mutation and backup/reset routes', () => {
    const client = readSource('src/devApi/devApiReadOnlyClient.ts');
    const comparison = readSource('src/devApi/devApiReadOnlyComparison.ts');
    const source = `${client}\n${comparison}`;

    expect(source).not.toMatch(/\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source).not.toMatch(/\/sessions\/start|\/sessions\/active\/patches|\/sessions\/active\/complete|\/sessions\/active\/discard/);
    expect(source).not.toMatch(/\/history\/:id\/edit|\/history\/:id\/data-flag/);
    expect(source).not.toMatch(/\/data-health\/issues\/:issueId\/dismiss|\/data-health\/repair\/apply/);
    expect(source).not.toMatch(/\/backup|backup\/|importBackup|exportBackup|\/reset|\/recovery|resetDev/i);
  });
});
