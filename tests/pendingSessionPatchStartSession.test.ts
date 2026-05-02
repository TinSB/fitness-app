import { describe, expect, it } from 'vitest';
import {
  applySessionPatches,
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { makeAppData, getTemplate } from './fixtures';

const temporaryPatch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练，不修改原模板。',
  reason: '今天状态一般，先保证主训练质量。',
  reversible: true,
};

const createBaseSession = () => {
  const data = makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' });
  const session = createSession(
    getTemplate('pull-a'),
    data.todayStatus,
    data.history,
    data.trainingMode,
    buildWeeklyPrescription(data),
    undefined,
    data.screeningProfile,
    data.mesocyclePlan,
  );
  return { data, session };
};

describe('pending session patch startSession flow', () => {
  it('consumes persisted pending patches through the same state transition shape as startSession', () => {
    const { data, session } = createBaseSession();
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const currentData = { ...data, pendingSessionPatches: [pending], settings: { ...data.settings, pendingSessionPatches: [pending] } };
    const activePending = findActivePendingSessionPatch(currentData.pendingSessionPatches, '2026-05-01', 'pull-a');
    const patched = applySessionPatches(session, activePending?.patches || []);
    const nextPendingPatches = activePending
      ? markPendingSessionPatchConsumed(currentData.pendingSessionPatches, activePending.id, '2026-05-01T08:00:00.000Z')
      : currentData.pendingSessionPatches;
    const nextData = {
      ...currentData,
      activeSession: patched.session,
      pendingSessionPatches: nextPendingPatches,
      settings: { ...currentData.settings, pendingSessionPatches: nextPendingPatches },
    };

    expect(nextData.activeSession.appliedCoachActions).toHaveLength(1);
    expect(nextData.activeSession.appliedCoachActions?.[0]).toMatchObject({ id: temporaryPatch.id, type: temporaryPatch.type });
    expect(nextData.pendingSessionPatches).toEqual([
      expect.objectContaining({ id: pending.id, status: 'consumed', consumedAt: '2026-05-01T08:00:00.000Z' }),
    ]);
    expect(nextData.settings.pendingSessionPatches).toEqual(nextData.pendingSessionPatches);
  });

  it('applies active pending patches into the created session and marks them consumed', () => {
    const { session } = createBaseSession();
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });

    const activePending = findActivePendingSessionPatch([pending], '2026-05-01', 'pull-a');
    const patched = applySessionPatches(session, activePending?.patches || []);
    const consumed = markPendingSessionPatchConsumed([pending], pending.id, '2026-05-01T08:00:00.000Z');

    expect(patched.appliedPatches).toHaveLength(1);
    expect(patched.session.appliedCoachActions?.[0].id).toBe(temporaryPatch.id);
    expect(patched.session.adjustmentNotes?.join(' ')).toContain('只做主训练');
    expect(consumed[0]).toMatchObject({ id: pending.id, status: 'consumed' });
  });

  it('does not consume mismatched or expired pending patches', () => {
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });

    expect(findActivePendingSessionPatch([pending], '2026-05-01', 'push-a')).toBeUndefined();
    expect(findActivePendingSessionPatch([pending], '2026-05-02', 'pull-a')).toBeUndefined();
  });

  it('keeps program template and mesocycle untouched when applying the patch to a session', () => {
    const { data, session } = createBaseSession();
    const originalProgramTemplate = JSON.stringify(data.programTemplate);
    const originalMesocyclePlan = JSON.stringify(data.mesocyclePlan);

    applySessionPatches(session, [temporaryPatch]);

    expect(JSON.stringify(data.programTemplate)).toBe(originalProgramTemplate);
    expect(JSON.stringify(data.mesocyclePlan)).toBe(originalMesocyclePlan);
  });
});
