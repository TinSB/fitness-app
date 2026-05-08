import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src';
import { reconcileScreeningProfile } from '../src/engines/adaptiveFeedbackEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import { createSession } from '../src/engines/sessionBuilder';
import {
  applySessionPatches,
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import {
  buildIncompleteMainWorkGuard,
  completeTrainingSessionIntoHistory,
} from '../src/engines/trainingCompletionEngine';
import { getTemplate, makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const NOW = '2026-05-08T09:00:00.000Z';
const FINISH = '2026-05-08T10:00:00.000Z';

const mainOnlyPatch: SessionPatch = {
  id: 'api-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练。',
  reason: '状态一般，先保证主训练质量。',
  reversible: true,
};

const withoutAppliedAt = <T extends { appliedCoachActions?: Array<Record<string, unknown>> }>(session: T): T => ({
  ...session,
  appliedCoachActions: session.appliedCoachActions?.map(({ appliedAt: _appliedAt, ...item }) => item),
});

const buildExpectedStartedSession = (data: ReturnType<typeof makeAppData>, templateId: string) => {
  const template = getTemplate(templateId);
  const screeningProfile = reconcileScreeningProfile(data.screeningProfile, data.history);
  const activeProgramTemplateId = data.activeProgramTemplateId || data.selectedTemplateId || templateId;
  const workingData = {
    ...data,
    screeningProfile,
    selectedTemplateId: templateId,
    activeProgramTemplateId,
  };
  const decisionContext = buildTrainingDecisionContext(workingData, NOW.slice(0, 10), {
    screeningProfile,
    selectedTemplateId: templateId,
    activeProgramTemplateId,
    currentTrainingTemplate: template,
    activeTemplate: template,
  });
  return createSession(
    template,
    data.todayStatus,
    data.history,
    data.trainingMode,
    buildWeeklyPrescription(data),
    undefined,
    screeningProfile,
    data.mesocyclePlan,
    decisionContext,
  );
};

describe('session mutation API parity', () => {
  it('starts a session with the same pending patch state shape as existing engines', () => {
    const pending = buildPendingSessionPatch({
      patches: [mainOnlyPatch],
      createdAt: NOW,
      sourceFingerprint: 'api-parity-main-only',
      targetTemplateId: 'pull-a',
    });
    const data = makeAppData({
      selectedTemplateId: 'pull-a',
      activeProgramTemplateId: 'pull-a',
      pendingSessionPatches: [pending],
      settings: { pendingSessionPatches: [pending] },
    });

    const response = handleSessionMutationRequest(data, { method: 'POST', path: '/sessions/start', nowIso: NOW });
    const expectedBase = buildExpectedStartedSession(data, 'pull-a');
    const expectedActivePending = findActivePendingSessionPatch(data.pendingSessionPatches, NOW.slice(0, 10), 'pull-a');
    const expectedPatched = applySessionPatches(expectedBase, expectedActivePending?.patches || []);
    const expectedPending = markPendingSessionPatchConsumed(data.pendingSessionPatches, pending.id, NOW);

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_started' });
    expect(response.nextData?.activeSession).toMatchObject({
      templateId: expectedPatched.session.templateId,
      programTemplateId: expectedPatched.session.programTemplateId,
      adjustmentType: expectedPatched.session.adjustmentType,
      startedAt: NOW,
      date: NOW.slice(0, 10),
    });
    expect(response.nextData?.activeSession?.appliedCoachActions?.map((patch) => patch.id)).toEqual(
      expectedPatched.session.appliedCoachActions?.map((patch) => patch.id),
    );
    expect(response.nextData?.pendingSessionPatches).toEqual(expectedPending);
    expect(response.nextData?.settings.pendingSessionPatches).toEqual(expectedPending);
  });

  it('applies active session patches with the same result as applySessionPatches', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 3, 0)]);
    const data = makeAppData({ activeSession });
    const response = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/patches',
      body: { patches: [mainOnlyPatch] },
      nowIso: NOW,
    });
    const expected = applySessionPatches(activeSession, [mainOnlyPatch]);

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_patches_applied' });
    expect(withoutAppliedAt(response.nextData!.activeSession!)).toEqual(withoutAppliedAt(expected.session));
  });

  it('completes a session with the same output as completeTrainingSessionIntoHistory', () => {
    const activeSession = {
      ...makeFocusSession([makeExercise('bench-press', 1, 1)]),
      startedAt: NOW,
    };
    const data = makeAppData({ activeSession });
    const response = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/complete',
      nowIso: FINISH,
    });
    const expected = completeTrainingSessionIntoHistory(data, FINISH, { endedEarly: false });

    expect(buildIncompleteMainWorkGuard(activeSession).hasIncompleteMainWork).toBe(false);
    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_completed' });
    expect(response.nextData).toEqual(expected.data);
  });

  it('confirms incomplete main work before completing and preserves engine parity after confirmation', () => {
    const activeSession = {
      ...makeFocusSession([makeExercise('bench-press', 2, 1)]),
      startedAt: NOW,
    };
    const data = makeAppData({ activeSession });
    const gate = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/complete',
      nowIso: FINISH,
    });
    const confirmed = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/active/complete',
      body: { confirmIncompleteMainWork: true },
      nowIso: FINISH,
    });
    const expected = completeTrainingSessionIntoHistory(data, FINISH, { endedEarly: true });

    expect(gate.result).toMatchObject({
      changed: false,
      requiresConfirmation: true,
      reasonCode: 'incomplete_main_work_requires_confirmation',
    });
    expect(gate.nextData).toBeUndefined();
    expect(confirmed.result.reasonCode).toBe('session_completed');
    expect(confirmed.nextData).toEqual(expected.data);
  });
});
