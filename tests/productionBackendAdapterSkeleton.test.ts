import { describe, expect, it } from 'vitest';
import {
  createProductionBackendAdapter,
  PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES,
} from '../apps/api/src/node/productionBackendAdapter';

describe('production backend adapter skeleton', () => {
  it('creates a Node-only inert adapter without auto-listen behavior', () => {
    const adapter = createProductionBackendAdapter('staging');

    expect(adapter).toMatchObject({
      kind: 'production-backend-adapter-skeleton',
      environment: 'staging',
      autoListen: false,
      activated: false,
    });
    expect(typeof adapter.handle).toBe('function');
  });

  it('preserves the accepted seven browser mutation routes without adding routes', () => {
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

  it('returns safe unavailable responses for accepted routes without fake success', () => {
    const adapter = createProductionBackendAdapter();
    const response = adapter.handle({
      method: 'POST',
      path: '/sessions/active/discard',
      requestId: 'req-discard',
      body: { rawAppData: { token: 'secret-token', localStorageDump: 'private-training-data' } },
    });

    expect(response).toEqual({
      ok: false,
      status: 503,
      requestId: 'req-discard',
      error: {
        code: 'production_backend_not_activated',
        message: 'Production backend adapter skeleton is inert and does not execute production writes.',
        retryable: false,
      },
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
    expect(JSON.stringify(response)).not.toContain('private-training-data');
  });

  it('rejects unapproved routes without executing writes', () => {
    const adapter = createProductionBackendAdapter();

    expect(adapter.handle({ method: 'POST', path: '/data-health/repair/apply' })).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'route_not_allowed', retryable: false },
    });
    expect(adapter.handle({ method: 'POST', path: '/backup/export' })).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'route_not_allowed', retryable: false },
    });
  });
});
