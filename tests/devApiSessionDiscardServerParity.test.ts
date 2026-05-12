import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('Dev API session discard server parity', () => {
  it('matches the existing server-side session discard route', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 1, 0)]);
    const source = makeAppData({ activeSession, history: [] });
    const response = handleSessionMutationRequest(source, {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: {
        activeSessionId: activeSession.id,
        sourceSnapshotHash: 'source',
        sourceSnapshotVersion: 'phase5-session-discard-v1',
        mutationId: 'mutation',
        idempotencyKey: 'key',
        requestFingerprint: 'request',
        confirmed: true,
        confirmDiscard: true,
      },
      nowIso: '2026-05-12T01:00:00.000Z',
    });

    expect(DEV_API_SESSION_DISCARD_ROUTE).toBe('/sessions/active/discard');
    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'session_discarded',
    });
    expect(response.nextData?.activeSession).toBeNull();
    expect(response.nextData?.history).toEqual([]);
    expect(source.activeSession).toEqual(activeSession);
  });

  it('maps missing active session and missing confirmation to non-success', () => {
    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: { confirmDiscard: true },
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'no_active_session' },
    });

    expect(handleSessionMutationRequest(makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
    }), {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: {},
    })).toMatchObject({
      status: 409,
      result: {
        ok: false,
        changed: false,
        requiresConfirmation: true,
        reasonCode: 'discard_requires_confirmation',
      },
    });
  });
});
