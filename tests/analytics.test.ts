import { describe, expect, it } from 'vitest';
import { buildAdherenceReport } from '../src/engines/analytics';
import { makeSession } from './fixtures';

describe('analytics adherence', () => {
  it('supportExerciseLogs drive correction and functional adherence', () => {
    const session = makeSession({
      id: 's1',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 60, reps: 8 },
        { weight: 60, reps: 8 },
        { weight: 60, reps: 8 },
      ],
    });

    session.supportExerciseLogs = [
      {
        moduleId: 'corr_upper_crossed_01',
        exerciseId: 'wall_slide',
        blockType: 'correction',
        plannedSets: 2,
        completedSets: 1,
        skippedReason: 'time',
      },
      {
        moduleId: 'func_core_anti_rotation_01',
        exerciseId: 'pallof_press',
        blockType: 'functional',
        plannedSets: 3,
        completedSets: 0,
        skippedReason: 'too_tired',
      },
    ];

    const report = buildAdherenceReport([session]);
    expect(report.correctionRate).toBe(50);
    expect(report.functionalRate).toBe(0);
    expect(report.skippedSupportExercises[0]?.exerciseId).toBeTruthy();
  });

  it('old sessions without supportExerciseLogs do not fake 100 percent support completion', () => {
    const session = makeSession({
      id: 'legacy',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8 }],
    });
    session.correctionBlock = [
      {
        id: 'corr_upper_crossed_01',
        name: '纠偏',
        targetIssue: 'upper_crossed',
        stage: 'warmup',
        durationMin: 8,
        exercises: [{ exerciseId: 'wall_slide', sets: 2, repMin: 10, repMax: 12 }],
      },
    ];

    const report = buildAdherenceReport([session]);
    expect(report.correctionRate).toBeUndefined();
    expect(report.confidence).toBe('low');
  });
});
