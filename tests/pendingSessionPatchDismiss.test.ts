import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchDismissed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';

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

  it('documents that App revert flow dismisses persisted pending patch instead of clearing local state', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(app).toContain('markPendingSessionPatchDismissed');
    expect(app).toContain('pending_patch_dismissed');
    expect(app).not.toContain('setPendingSessionPatches([])');
  });
});
