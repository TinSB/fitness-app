import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src';
import { applySessionPatches, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { getTemplate, makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const NOW = '2026-05-08T09:00:00.000Z';

const patch: SessionPatch = {
  id: 'api-invalid-boundary-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练。',
  reason: '测试无变化路径。',
  reversible: true,
};

describe('session mutation API invalid boundaries', () => {
  it('rejects start conflicts and missing templates without nextData', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 1, 0)]);
    const activeConflict = handleSessionMutationRequest(makeAppData({ activeSession }), {
      method: 'POST',
      path: '/sessions/start',
      nowIso: NOW,
    });
    const missingTemplate = handleSessionMutationRequest(
      makeAppData({ templates: [getTemplate('push-a')], selectedTemplateId: 'pull-a' }),
      {
        method: 'POST',
        path: '/sessions/start',
        body: { templateId: 'pull-a' },
        nowIso: NOW,
      },
    );

    expect(activeConflict.result.reasonCode).toBe('active_session_exists');
    expect(missingTemplate.result.reasonCode).toBe('template_not_found');
    expect(activeConflict.nextData).toBeUndefined();
    expect(missingTemplate.nextData).toBeUndefined();
  });

  it('rejects complete and discard without an active session', () => {
    const complete = handleSessionMutationRequest(makeAppData(), {
      method: 'POST',
      path: '/sessions/active/complete',
      nowIso: NOW,
    });
    const discard = handleSessionMutationRequest(makeAppData(), {
      method: 'POST',
      path: '/sessions/active/discard',
      body: { confirmDiscard: true },
      nowIso: NOW,
    });

    expect(complete.result.reasonCode).toBe('no_active_session');
    expect(discard.result.reasonCode).toBe('no_active_session');
    expect(complete.nextData).toBeUndefined();
    expect(discard.nextData).toBeUndefined();
  });

  it('returns pending_patch_not_found or no_change without writable data', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 0)]);
    const missingPending = handleSessionMutationRequest(makeAppData({ activeSession }), {
      method: 'POST',
      path: '/sessions/active/patches',
      body: { pendingPatchId: 'missing-pending' },
      nowIso: NOW,
    });
    const patchedOnce = applySessionPatches(activeSession, [patch]).session;
    const noChange = handleSessionMutationRequest(makeAppData({ activeSession: patchedOnce }), {
      method: 'POST',
      path: '/sessions/active/patches',
      body: { patches: [patch] },
      nowIso: NOW,
    });
    const unknownBody = handleSessionMutationRequest(makeAppData({ activeSession }), {
      method: 'POST',
      path: '/sessions/active/patches',
      body: 'not-an-object',
      nowIso: NOW,
    });

    expect(missingPending.result.reasonCode).toBe('pending_patch_not_found');
    expect(noChange.result.reasonCode).toBe('no_change');
    expect(unknownBody.result.reasonCode).toBe('no_change');
    expect(missingPending.nextData).toBeUndefined();
    expect(noChange.nextData).toBeUndefined();
    expect(unknownBody.nextData).toBeUndefined();
  });

  it('gates incomplete completion and discard confirmation without changing state', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 3, 1)]);
    const data = makeAppData({ activeSession, history: [] });
    const incomplete = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/complete',
      nowIso: '2026-05-08T10:00:00.000Z',
    });
    const discardGate = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/discard',
      nowIso: NOW,
    });

    expect(incomplete.result).toMatchObject({
      changed: false,
      requiresConfirmation: true,
      reasonCode: 'incomplete_main_work_requires_confirmation',
    });
    expect(discardGate.result).toMatchObject({
      changed: false,
      requiresConfirmation: true,
      reasonCode: 'discard_requires_confirmation',
    });
    expect(incomplete.nextData).toBeUndefined();
    expect(discardGate.nextData).toBeUndefined();
    expect(data.history).toEqual([]);
    expect(data.activeSession).toBe(activeSession);
  });
});

