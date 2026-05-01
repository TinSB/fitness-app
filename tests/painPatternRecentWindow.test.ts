import { describe, expect, it } from 'vitest';
import { buildPainPatterns } from '../src/engines/painPatternEngine';
import { makeSession } from './fixtures';

describe('painPattern recent window', () => {
  it('ignores old pain flags outside the recent window', () => {
    const oldSession = makeSession({
      id: 'old-pain',
      date: '2026-03-01',
      templateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
    });

    expect(buildPainPatterns([oldSession], { currentDate: '2026-05-01' })).toEqual([]);
  });

  it('sorts unordered history by finishedAt and keeps recent pain flags', () => {
    const older = {
      ...makeSession({
        id: 'older-pain',
        date: '2026-04-20',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
      }),
      finishedAt: '2026-04-20T09:00:00.000Z',
    };
    const newer = {
      ...makeSession({
        id: 'newer-pain',
        date: '2026-04-29',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
      }),
      finishedAt: '2026-04-29T09:00:00.000Z',
    };

    const patterns = buildPainPatterns([older, newer], { currentDate: '2026-05-01' });

    expect(patterns.some((pattern) => pattern.exerciseId === 'lat-pulldown')).toBe(true);
    expect(patterns[0]?.lastOccurredAt).toBe('2026-04-29');
  });

  it('excludes test and excluded sessions', () => {
    const testSession = {
      ...makeSession({
        id: 'test-pain',
        date: '2026-04-29',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
      }),
      dataFlag: 'test' as const,
    };
    const excludedSession = {
      ...makeSession({
        id: 'excluded-pain',
        date: '2026-04-30',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
      }),
      dataFlag: 'excluded' as const,
    };

    expect(buildPainPatterns([testSession, excludedSession], { currentDate: '2026-05-01' })).toEqual([]);
  });
});
