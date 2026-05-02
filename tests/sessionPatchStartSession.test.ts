import { describe, expect, it } from 'vitest';
import { createSession } from '../src/engines/sessionBuilder';
import {
  applySessionPatches,
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import { getTemplate, makeAppData } from './fixtures';

const temporaryPatch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练，不修改原模板。',
  reason: '今天可训练时间有限，优先完成主训练。',
  reversible: true,
};

const createBaseSession = () => {
  const data = makeAppData({ selectedTemplateId: 'push-a', activeProgramTemplateId: 'push-a' });
  return {
    data,
    session: createSession(
      getTemplate('push-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    ),
  };
};

describe('session patch startSession flow', () => {
  it('consumes a matching pending patch through the same state transition used by startSession', () => {
    const { data, session } = createBaseSession();
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:push-a:main-only',
      targetTemplateId: 'push-a',
    });
    const currentData = {
      ...data,
      pendingSessionPatches: [pending],
      settings: { ...data.settings, pendingSessionPatches: [pending] },
    };

    const activePending = findActivePendingSessionPatch(currentData.pendingSessionPatches, '2026-05-01', 'push-a');
    expect(activePending).toMatchObject({ id: pending.id, status: 'pending', targetTemplateId: 'push-a' });

    const patched = applySessionPatches(session, activePending?.patches || []);
    const consumed = markPendingSessionPatchConsumed(currentData.pendingSessionPatches, pending.id, '2026-05-01T08:00:00.000Z');
    const nextData = {
      ...currentData,
      activeSession: patched.session,
      pendingSessionPatches: consumed,
      settings: { ...currentData.settings, pendingSessionPatches: consumed },
    };

    expect(nextData.activeSession.appliedCoachActions).toEqual([
      expect.objectContaining({ id: temporaryPatch.id, type: temporaryPatch.type, title: temporaryPatch.title }),
    ]);
    expect(nextData.activeSession.adjustmentNotes).toEqual(expect.arrayContaining([temporaryPatch.title, temporaryPatch.description]));
    expect(nextData.activeSession.adjustmentType).toBe('temporary_main_only');
    expect(nextData.pendingSessionPatches).toEqual([
      expect.objectContaining({ id: pending.id, status: 'consumed', consumedAt: '2026-05-01T08:00:00.000Z' }),
    ]);
    expect(nextData.settings.pendingSessionPatches).toEqual(nextData.pendingSessionPatches);
    expect(findActivePendingSessionPatch(nextData.pendingSessionPatches, '2026-05-01', 'push-a')).toBeUndefined();
  });

  it('writes applied patches and adjustment notes into the active session only', () => {
    const { data, session } = createBaseSession();
    const originalProgramTemplate = JSON.stringify(data.programTemplate);
    const originalMesocyclePlan = JSON.stringify(data.mesocyclePlan);
    const originalTemplates = JSON.stringify(data.templates);

    const result = applySessionPatches(session, [temporaryPatch]);

    expect(result.session.appliedCoachActions?.[0]).toMatchObject({
      id: temporaryPatch.id,
      type: temporaryPatch.type,
      title: temporaryPatch.title,
    });
    expect(result.session.adjustmentNotes?.join(' ')).toContain('只做主训练');
    expect(result.session.adjustmentReasons?.join(' ')).toContain('优先完成主训练');
    expect(result.session.adjustmentType).toBe('temporary_main_only');
    expect(JSON.stringify(data.programTemplate)).toBe(originalProgramTemplate);
    expect(JSON.stringify(data.mesocyclePlan)).toBe(originalMesocyclePlan);
    expect(JSON.stringify(data.templates)).toBe(originalTemplates);
  });

  it('preserves applied patches when the active session is saved into history', () => {
    const { data, session } = createBaseSession();
    const patched = applySessionPatches(session, [temporaryPatch]).session;
    const completed = completeTrainingSessionIntoHistory({ ...data, activeSession: patched }, '2026-04-29T10:30:00.000Z');

    expect(completed.session?.appliedCoachActions?.[0].id).toBe(temporaryPatch.id);
    expect(completed.session?.adjustmentNotes?.join(' ')).toContain('只做主训练');
    expect(completed.data.history[0].appliedCoachActions?.[0].id).toBe(temporaryPatch.id);
  });

  it('does not automatically inherit temporary patches into the next session', () => {
    const { data, session } = createBaseSession();
    const patched = applySessionPatches(session, [temporaryPatch]).session;
    const completed = completeTrainingSessionIntoHistory({ ...data, activeSession: patched }, '2026-04-29T10:30:00.000Z');
    const nextSession = createSession(
      getTemplate('push-a'),
      data.todayStatus,
      completed.data.history,
      data.trainingMode,
      buildWeeklyPrescription(completed.data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(nextSession.appliedCoachActions || []).toHaveLength(0);
    expect(nextSession.adjustmentNotes || []).toHaveLength(0);
    expect(nextSession.adjustmentType).toBeUndefined();
  });
});
