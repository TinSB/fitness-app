import { describe, expect, it } from 'vitest';
import { createSessionDiscardMetadata, createSessionDiscardSourceContext } from '../src/devApi/DevApiSessionDiscardPrototype';
import { DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Dev API session discard semantics', () => {
  it('keeps source snapshot derived from local AppData without mutating it', () => {
    const data = makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
    });
    const before = JSON.stringify(data);
    const context = createSessionDiscardSourceContext(data);
    const metadata = createSessionDiscardMetadata({
      sourceContext: context!,
      nowIso: '2026-05-12T00:00:00.000Z',
    });

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      sourceSnapshotVersion: 'phase5-session-discard-v1',
    });
    expect(metadata.sourceSnapshotHash).toBe(context?.sourceSnapshotHash);
    expect(metadata.confirmDiscard).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('adds only the session discard route and does not alter patch or complete clients', () => {
    expect(DEV_API_SESSION_DISCARD_ROUTE).toBe('/sessions/active/discard');

    const source = [
      readSource('src/devApi/devApiSessionDiscardClient.ts'),
      readSource('src/devApi/DevApiSessionDiscardPrototype.tsx'),
    ].join('\n');

    expect(source).not.toContain('/sessions/active/patches');
    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toMatch(/completeSessionViaDevApi|applySessionPatchViaDevApi/);
  });

  it('does not change training algorithms or backup import/export semantics', () => {
    const source = [
      readSource('src/devApi/devApiSessionDiscardClient.ts'),
      readSource('src/devApi/DevApiSessionDiscardPrototype.tsx'),
      readSource('src/devApi/devApiSessionDiscardConfig.ts'),
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
