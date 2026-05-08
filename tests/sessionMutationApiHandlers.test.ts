import { describe, expect, it } from 'vitest';
import {
  SESSION_MUTATION_ROUTES,
  handleSessionMutationRequest,
} from '../apps/api/src';
import type { SessionMutationResponse } from '../packages/contracts/src';
import { makeAppData } from './fixtures';

const expectNoNextData = (response: SessionMutationResponse) => {
  expect(response.result.ok && response.result.changed).toBe(false);
  expect(response.nextData).toBeUndefined();
};

describe('session mutation API handlers', () => {
  it('declares only the four supported session mutation routes', () => {
    expect(SESSION_MUTATION_ROUTES).toEqual([
      expect.objectContaining({ method: 'POST', path: '/sessions/start' }),
      expect.objectContaining({ method: 'POST', path: '/sessions/active/patches' }),
      expect.objectContaining({ method: 'POST', path: '/sessions/active/complete' }),
      expect.objectContaining({ method: 'POST', path: '/sessions/active/discard' }),
    ]);
    expect(SESSION_MUTATION_ROUTES).toHaveLength(4);
    expect(SESSION_MUTATION_ROUTES.every((route) => route.method === 'POST')).toBe(true);
  });

  it('dispatches supported routes and keeps unsupported routes non-writable', () => {
    const data = makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' });
    const start = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/start',
      nowIso: '2026-05-08T09:00:00.000Z',
    });

    expect(start.status).toBe(200);
    expect(start.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_started' });
    expect(start.nextData?.activeSession?.templateId).toBe('pull-a');

    const patches = handleSessionMutationRequest(start.nextData!, {
      method: 'POST',
      path: '/sessions/active/patches',
      body: { patches: [] },
      nowIso: '2026-05-08T09:05:00.000Z',
    });
    expect(patches.status).toBe(200);
    expect(patches.result.reasonCode).toBe('no_change');
    expectNoNextData(patches);

    const complete = handleSessionMutationRequest(start.nextData!, {
      method: 'POST',
      path: '/sessions/active/complete',
      body: { confirmIncompleteMainWork: true },
      nowIso: '2026-05-08T10:00:00.000Z',
    });
    expect(complete.status).toBe(200);
    expect(complete.result.reasonCode).toBe('session_completed');
    expect(complete.nextData?.activeSession).toBeNull();

    const discard = handleSessionMutationRequest(start.nextData!, {
      method: 'POST',
      path: '/sessions/active/discard',
      body: { confirmDiscard: true },
      nowIso: '2026-05-08T09:30:00.000Z',
    });
    expect(discard.status).toBe(200);
    expect(discard.result.reasonCode).toBe('session_discarded');
    expect(discard.nextData?.activeSession).toBeNull();
  });

  it('returns 405 or 404 without nextData for unsupported dispatch paths', () => {
    const data = makeAppData();
    const wrongMethod = handleSessionMutationRequest(data, { method: 'GET', path: '/sessions/start' });
    const unknownRoute = handleSessionMutationRequest(data, { method: 'POST', path: '/sessions/unknown' });

    expect(wrongMethod).toMatchObject({ status: 405, result: { reasonCode: 'unsupported_route' } });
    expect(unknownRoute).toMatchObject({ status: 404, result: { reasonCode: 'unsupported_route' } });
    expectNoNextData(wrongMethod);
    expectNoNextData(unknownRoute);
  });
});
