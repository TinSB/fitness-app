import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { makeAppData, getTemplate } from './fixtures';

describe('Dev API session start server parity', () => {
  it('matches the existing server-side session start route', () => {
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');

    const response = handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_START_ROUTE,
      body: {
        templateId: 'push-a',
        sourceSnapshotHash: 'source',
        sourceSnapshotVersion: 'phase4-active-session-v1',
        mutationId: 'mutation',
        idempotencyKey: 'key',
        requestFingerprint: 'request',
        confirmed: true,
      },
      nowIso: '2026-05-11T00:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'session_started',
    });
    expect(response.nextData?.activeSession?.templateId).toBe('push-a');
    expect(response.nextData?.activeSession?.templateName).toBe(getTemplate('push-a').name);
  });

  it('maps active session and missing template to non-success', () => {
    const activeSession = {
      id: 'active-1',
      date: '2026-05-11',
      templateId: 'push-a',
      templateName: 'Push A',
      trainingMode: 'hybrid' as const,
      focus: 'push',
      exercises: [],
      status: makeAppData().todayStatus,
      completed: false,
    };

    expect(handleSessionMutationRequest(makeAppData({ activeSession }), {
      method: 'POST',
      path: DEV_API_SESSION_START_ROUTE,
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'active_session_exists' },
    });

    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_START_ROUTE,
      body: { templateId: 'missing-template' },
    })).toMatchObject({
      status: 404,
      result: { ok: false, changed: false, reasonCode: 'template_not_found' },
    });
  });

  it('does not implement active patch, complete, or discard from the browser prototype', () => {
    const source = [
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
    ];
    expect(source).toEqual([
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
    ]);
  });
});
