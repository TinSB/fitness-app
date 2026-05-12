import { describe, expect, it } from 'vitest';
import {
  createProductionBackendAdapter,
  PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES,
} from '../apps/api/src/node/productionBackendAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production backend adapter acceptance', () => {
  it('accepts the skeleton as Node-only inert scaffolding', () => {
    const source = readSource('apps/api/src/node/productionBackendAdapter.ts');
    const adapter = createProductionBackendAdapter('production');

    expect(adapter.autoListen).toBe(false);
    expect(adapter.activated).toBe(false);
    expect(source).not.toContain('listen(');
    expect(source).not.toContain('createServer');
    expect(source).not.toContain('from "fastify"');
    expect(source).not.toContain("from 'fastify'");
  });

  it('preserves the exact accepted browser mutation route allowlist', () => {
    expect(PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES).toEqual([
      { method: 'POST', path: '/data-health/issues/:issueId/dismiss' },
      { method: 'POST', path: '/history/:id/data-flag' },
      { method: 'POST', path: '/history/:id/edit' },
      { method: 'POST', path: '/sessions/start' },
      { method: 'POST', path: '/sessions/active/patches' },
      { method: 'POST', path: '/sessions/active/complete' },
      { method: 'POST', path: '/sessions/active/discard' },
    ]);
  });

  it('returns no fake success for accepted routes', () => {
    const adapter = createProductionBackendAdapter();

    expect(adapter.handle({ method: 'POST', path: '/history/workout-1/edit' })).toMatchObject({
      ok: false,
      status: 503,
      error: { code: 'production_backend_not_activated', retryable: false },
    });
  });

  it('keeps safe error envelopes without echoing sensitive request data', () => {
    const adapter = createProductionBackendAdapter();
    const response = adapter.handle({
      method: 'POST',
      path: '/sessions/start',
      requestId: 'req-sensitive',
      headers: { authorization: 'Bearer secret-token' },
      body: {
        localStorageDump: 'private-local-storage',
        appData: { athlete: 'personal-training-data' },
      },
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('private-local-storage');
    expect(serialized).not.toContain('personal-training-data');
    expect(response.requestId).toBe('req-sensitive');
  });
});
