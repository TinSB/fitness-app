import { describe, expect, it } from 'vitest';
import { buildPainPatterns } from '../src/engines/painPatternEngine';
import { makeSession } from './fixtures';

describe('painPatternEngine', () => {
  it('repeated pain on the same exercise suggests substitution', () => {
    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 4 }],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-21',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 4 }],
      }),
    ];

    const patterns = buildPainPatterns(history);
    const benchPattern = patterns.find((item) => item.exerciseId === 'bench-press');
    expect(benchPattern?.suggestedAction).toBe('substitute');
  });

  it('multiple pain areas can escalate to deload or watch', () => {
    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 3 }],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-22',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [{ weight: 80, reps: 5, painFlag: true, painArea: 'knee', painSeverity: 3 }],
      }),
    ];

    const patterns = buildPainPatterns(history);
    const areaPattern = patterns.find((item) => !item.exerciseId);
    expect(['watch', 'deload', 'seek_professional']).toContain(areaPattern?.suggestedAction);
  });

  it('high severity can suggest seeking professional help', () => {
    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 5 }],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-21',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 5 }],
      }),
      makeSession({
        id: 's3',
        date: '2026-04-18',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 60, reps: 6, painFlag: true, painArea: 'shoulder', painSeverity: 5 }],
      }),
    ];

    const patterns = buildPainPatterns(history);
    const pattern = patterns.find((item) => item.exerciseId === 'bench-press');
    expect(['substitute', 'seek_professional']).toContain(pattern?.suggestedAction);
  });
});
