import { describe, expect, it } from 'vitest';
import { createSessionPatchMetadata, createSessionPatchSourceContext } from '../src/devApi/DevApiSessionPatchPrototype';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import type { PendingSessionPatch } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const pendingPatch: PendingSessionPatch = {
  id: 'pending-main-only',
  createdAt: '2026-05-11T00:00:00.000Z',
  sourceFingerprint: 'semantics-main-only',
  targetTemplateId: 'push-a',
  status: 'pending',
  patches: [{
    id: 'patch-main-only',
    type: 'main_only',
    title: 'Main work only',
    description: 'Keep main lifts only.',
    reason: 'Fatigue',
    reversible: true,
  }],
};

describe('Dev API session patch semantics', () => {
  it('keeps source snapshot derived from local AppData without mutating it', () => {
    const data = makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
      pendingSessionPatches: [pendingPatch],
      settings: { pendingSessionPatches: [pendingPatch] },
    });
    const before = JSON.stringify(data);
    const context = createSessionPatchSourceContext(data);
    const metadata = createSessionPatchMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      pendingPatchId: 'pending-main-only',
      sourceSnapshotVersion: 'phase5-session-patch-v1',
    });
    expect(metadata.sourceSnapshotHash).toBe(context?.sourceSnapshotHash);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('adds only the session patch route and keeps adjacent active-session routes blocked', () => {
    expect(DEV_API_SESSION_PATCH_ROUTE).toBe('/sessions/active/patches');

    const client = readSource('src/devApi/devApiSessionPatchClient.ts');
    const prototype = readSource('src/devApi/DevApiSessionPatchPrototype.tsx');
    const source = `${client}\n${prototype}`;

    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toContain('/sessions/active/discard');
    expect(source).not.toMatch(/completeTrainingSession|discardActiveSession/i);
  });

  it('does not change training algorithms or backup import/export semantics', () => {
    const source = [
      readSource('src/devApi/devApiSessionPatchClient.ts'),
      readSource('src/devApi/DevApiSessionPatchPrototype.tsx'),
      readSource('src/devApi/devApiSessionPatchConfig.ts'),
    ].join('\n');

    [
      'buildWeeklyPrescription',
      'buildTrainingDecisionContext',
      'completeTrainingSessionIntoHistory',
      'effectiveSet',
      'e1RM',
      'personalRecord',
      'exportAppData',
      'importAppData',
    ].forEach((token) => expect(source).not.toContain(token));
  });
});
