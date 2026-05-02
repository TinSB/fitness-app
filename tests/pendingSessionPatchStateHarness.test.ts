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
import { getTemplate, makeAppData } from './fixtures';

const patch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练。',
  reason: '今天状态一般。',
  reversible: true,
};

describe('pending session patch state harness', () => {
  it('applies and consumes the matching pending patch without touching the next session', () => {
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
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const activePending = findActivePendingSessionPatch([pending], '2026-05-01', 'pull-a');
    const patched = applySessionPatches(session, activePending?.patches || []);
    const consumed = markPendingSessionPatchConsumed([pending], pending.id, '2026-05-01T08:00:00.000Z');
    const nextActivePending = findActivePendingSessionPatch(consumed, '2026-05-01', 'pull-a');

    expect(patched.appliedPatches).toEqual([expect.objectContaining({ id: patch.id, type: patch.type })]);
    expect(consumed).toEqual([expect.objectContaining({ id: pending.id, status: 'consumed' })]);
    expect(nextActivePending).toBeUndefined();
  });
});
