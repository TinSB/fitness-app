import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src';
import type { SessionMutationResponse } from '../packages/contracts/src';
import { buildPendingSessionPatch, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { getTemplate, makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const NOW = '2026-05-08T09:00:00.000Z';

const patch: SessionPatch = {
  id: 'api-no-in-place-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练。',
  reason: '测试本次调整边界。',
  reversible: true,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const expectInputUnchanged = <T>(value: T, before: T) => {
  expect(value).toEqual(before);
};

const expectNextDataRule = (response: SessionMutationResponse) => {
  if (response.result.ok === true && response.result.changed === true) {
    expect(response.nextData).toBeDefined();
  } else {
    expect(response.nextData).toBeUndefined();
  }
};

describe('session mutation API no in-place mutation', () => {
  it('does not mutate input AppData for start, patch, complete, or discard', () => {
    const startData = makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' });
    const startBefore = clone(startData);
    const start = handleSessionMutationRequest(startData, { method: 'POST', path: '/sessions/start', nowIso: NOW });
    expectInputUnchanged(startData, startBefore);
    expectNextDataRule(start);

    const patchData = makeAppData({ activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]) });
    const patchBefore = clone(patchData);
    const patchResponse = handleSessionMutationRequest(patchData, {
      method: 'POST',
      path: '/sessions/active/patches',
      body: { patches: [patch] },
      nowIso: NOW,
    });
    expectInputUnchanged(patchData, patchBefore);
    expectNextDataRule(patchResponse);

    const completeData = makeAppData({
      activeSession: {
        ...makeFocusSession([makeExercise('bench-press', 1, 1)]),
        startedAt: NOW,
      },
    });
    const completeBefore = clone(completeData);
    const complete = handleSessionMutationRequest(completeData, {
      method: 'POST',
      path: '/sessions/active/complete',
      nowIso: '2026-05-08T10:00:00.000Z',
    });
    expectInputUnchanged(completeData, completeBefore);
    expectNextDataRule(complete);

    const discardData = makeAppData({ activeSession: makeFocusSession([makeExercise('bench-press', 1, 0)]) });
    const discardBefore = clone(discardData);
    const discard = handleSessionMutationRequest(discardData, {
      method: 'POST',
      path: '/sessions/active/discard',
      body: { confirmDiscard: true },
      nowIso: NOW,
    });
    expectInputUnchanged(discardData, discardBefore);
    expectNextDataRule(discard);
  });

  it('never returns nextData for failure, no-op, conflict, or confirmation paths', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: NOW,
      sourceFingerprint: 'api-missing-patch',
      targetTemplateId: 'pull-a',
    });
    const responses = [
      handleSessionMutationRequest(makeAppData({ activeSession }), { method: 'POST', path: '/sessions/start', nowIso: NOW }),
      handleSessionMutationRequest(makeAppData(), { method: 'POST', path: '/sessions/active/complete', nowIso: NOW }),
      handleSessionMutationRequest(makeAppData(), { method: 'POST', path: '/sessions/active/discard', nowIso: NOW }),
      handleSessionMutationRequest(makeAppData({ activeSession, pendingSessionPatches: [pending], settings: { pendingSessionPatches: [pending] } }), {
        method: 'POST',
        path: '/sessions/active/patches',
        body: { pendingPatchId: 'missing-patch' },
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData({ activeSession }), {
        method: 'POST',
        path: '/sessions/active/complete',
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData({ activeSession }), {
        method: 'POST',
        path: '/sessions/active/discard',
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData({ templates: [getTemplate('push-a')], selectedTemplateId: 'pull-a' }), {
        method: 'POST',
        path: '/sessions/start',
        body: { templateId: 'pull-a' },
        nowIso: NOW,
      }),
    ];

    responses.forEach((response) => {
      expect(response.result.ok && response.result.changed).toBe(false);
      expect(response.nextData).toBeUndefined();
    });
  });
});

