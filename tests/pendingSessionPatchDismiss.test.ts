import { describe, expect, it } from 'vitest';
import {
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchDismissed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { makeAppData } from './fixtures';

const patch: SessionPatch = {
  id: 'session-patch-reduce-volume',
  type: 'reduce_volume',
  title: '减少本次训练量',
  description: '只影响本次训练。',
  reason: '今天保守推进。',
  reversible: true,
};

describe('pending session patch dismiss', () => {
  it('marks pending patch dismissed so it no longer appears for Today or startSession', () => {
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });

    const dismissed = markPendingSessionPatchDismissed([pending], pending.id, '2026-05-01');

    expect(dismissed[0]).toMatchObject({ id: pending.id, status: 'dismissed', dismissedAt: '2026-05-01' });
    expect(findActivePendingSessionPatch(dismissed, '2026-05-01', 'pull-a')).toBeUndefined();
  });

  it('mirrors dismissed pending patch state through root AppData and settings', () => {
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const data = makeAppData({
      pendingSessionPatches: [pending],
      settings: { pendingSessionPatches: [pending] },
    });
    const nextPendingPatches = markPendingSessionPatchDismissed(data.pendingSessionPatches, pending.id, '2026-05-01T08:00:00.000Z');
    const nextData = {
      ...data,
      pendingSessionPatches: nextPendingPatches,
      settings: { ...data.settings, pendingSessionPatches: nextPendingPatches },
    };

    expect(nextData.pendingSessionPatches).toEqual([
      expect.objectContaining({ id: pending.id, status: 'dismissed', dismissedAt: '2026-05-01T08:00:00.000Z' }),
    ]);
    expect(nextData.settings.pendingSessionPatches).toEqual(nextData.pendingSessionPatches);
    expect(findActivePendingSessionPatch(nextData.pendingSessionPatches, '2026-05-01', 'pull-a')).toBeUndefined();
  });
});
