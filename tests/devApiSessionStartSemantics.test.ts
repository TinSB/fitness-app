import { describe, expect, it } from 'vitest';
import { createSessionStartMetadata, createSessionStartSourceContext } from '../src/devApi/DevApiSessionStartPrototype';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { makeAppData } from './fixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Dev API session start semantics', () => {
  it('keeps source snapshot derived from local AppData without mutating it', () => {
    const data = makeAppData({ selectedTemplateId: 'push-a', activeProgramTemplateId: 'push-a' });
    const before = JSON.stringify(data);
    const context = createSessionStartSourceContext(data);
    const metadata = createSessionStartMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });

    expect(context).toMatchObject({
      templateId: 'push-a',
      selectedTemplateId: 'push-a',
      activeProgramTemplateId: 'push-a',
      hasActiveSession: false,
    });
    expect(metadata.sourceSnapshotHash).toBe(context?.sourceSnapshotHash);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('adds only the session-start route and keeps active patch, complete, and discard blocked', () => {
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');

    const client = readSource('src/devApi/devApiSessionStartClient.ts');
    const prototype = readSource('src/devApi/DevApiSessionStartPrototype.tsx');
    const source = `${client}\n${prototype}`;

    expect(source).not.toContain('/sessions/active/patches');
    expect(source).not.toContain('/sessions/active/complete');
    expect(source).not.toContain('/sessions/active/discard');
    expect(source).not.toMatch(/completeTrainingSession|applySessionPatches|discard/i);
  });

  it('does not change training algorithms or backup import/export semantics', () => {
    const source = [
      readSource('src/devApi/devApiSessionStartClient.ts'),
      readSource('src/devApi/DevApiSessionStartPrototype.tsx'),
      readSource('src/devApi/devApiSessionStartConfig.ts'),
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
