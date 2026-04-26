import { describe, expect, it } from 'vitest';
import { buildAdherenceReport, buildMuscleVolumeDashboard, buildPrs } from '../src/engines/analytics';
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

describe('analytics personal record quality', () => {
  it('poor technique cannot generate a high quality PR', () => {
    const session = makeSession({
      id: 'poor-pr',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 3, techniqueQuality: 'poor' }],
    });

    const prs = buildPrs([session]);
    expect(prs.some((pr) => pr.quality === 'high_quality')).toBe(false);
    expect(prs.some((pr) => pr.quality === 'low_confidence')).toBe(true);
  });

  it('pain flagged sets cannot generate a high quality PR', () => {
    const session = makeSession({
      id: 'pain-pr',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 3, painFlag: true, techniqueQuality: 'good' }],
    });

    const prs = buildPrs([session]);
    expect(prs.some((pr) => pr.quality === 'high_quality')).toBe(false);
    expect(prs.some((pr) => pr.quality === 'low_confidence')).toBe(true);
  });

  it('does not pool high-quality PRs across exercise variants in the same equivalence chain', () => {
    const machine = makeSession({
      id: 'machine-pr',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'machine-chest-press',
      setSpecs: [{ weight: 110, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });

    const prs = buildPrs([machine]);
    expect(prs.some((pr) => pr.exerciseId === 'bench-press')).toBe(false);
    expect(prs.some((pr) => pr.exerciseId === 'machine-chest-press' && pr.quality === 'high_quality')).toBe(true);
  });
});

describe('muscle volume dashboard', () => {
  it('uses weighted effective sets and high-confidence counts', () => {
    const session = makeSession({
      id: 'weighted-dashboard',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    session.exercises[0].muscleContribution = { 胸: 1, 手臂: 0.5, 肩: 0.4 };

    const dashboard = buildMuscleVolumeDashboard([session], {
      weekStart: '2026-04-20',
      muscles: [
        { muscle: '胸', target: 2, sets: 0, remaining: 2, frequency: 1 },
        { muscle: '手臂', target: 2, sets: 0, remaining: 2, frequency: 1 },
      ],
    });

    const chest = dashboard.find((row) => row.muscleId === '胸');
    const arms = dashboard.find((row) => row.muscleId === '手臂');
    expect(chest?.weightedEffectiveSets).toBe(1);
    expect(chest?.highConfidenceEffectiveSets).toBe(1);
    expect(chest?.status).toBe('low');
    expect(arms?.weightedEffectiveSets).toBe(0.5);
  });

  it('marks volume as on target or high based on weighted effective sets', () => {
    const sessions = [0, 1, 2].map((index) =>
      makeSession({
        id: `volume-${index}`,
        date: `2026-04-2${index}`,
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
      })
    );
    sessions.forEach((session) => {
      session.exercises[0].muscleContribution = { 胸: 1 };
    });

    const dashboard = buildMuscleVolumeDashboard(sessions, {
      weekStart: '2026-04-20',
      muscles: [{ muscle: '胸', target: 3, sets: 0, remaining: 3, frequency: 1 }],
    });
    expect(dashboard.find((row) => row.muscleId === '胸')?.status).toBe('on_target');
  });
});
