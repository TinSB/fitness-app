import { describe, expect, it } from 'vitest';
import { createSessionCompleteMetadata, createSessionCompleteSourceContext } from '../src/devApi/DevApiSessionCompletePrototype';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Dev API session complete semantics', () => {
  it('keeps source snapshot derived from local AppData without mutating it', () => {
    const data = makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
    });
    const before = JSON.stringify(data);
    const context = createSessionCompleteSourceContext(data);
    const metadata = createSessionCompleteMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      sourceSnapshotVersion: 'phase5-session-complete-v1',
    });
    expect(metadata.sourceSnapshotHash).toBe(context?.sourceSnapshotHash);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('adds only the session complete route and keeps discard blocked', () => {
    expect(DEV_API_SESSION_COMPLETE_ROUTE).toBe('/sessions/active/complete');

    const client = readSource('src/devApi/devApiSessionCompleteClient.ts');
    const prototype = readSource('src/devApi/DevApiSessionCompletePrototype.tsx');
    const source = `${client}\n${prototype}`;

    expect(source).not.toContain('/sessions/active/discard');
    expect(source).not.toMatch(/discardActiveSession|confirmDiscard/i);
  });

  it('does not change training algorithms or backup import/export semantics', () => {
    const source = [
      readSource('src/devApi/devApiSessionCompleteClient.ts'),
      readSource('src/devApi/DevApiSessionCompletePrototype.tsx'),
      readSource('src/devApi/devApiSessionCompleteConfig.ts'),
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
