import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { buildWeeklyPrescription, selectCorrectionModules } from '../src/engines/supportPlanEngine';
import { getTemplate, makeAppData, makeSession, makeStatus } from './fixtures';

describe('supportPlanEngine', () => {
  it('upgrades and tapers correction modules based on adaptive issue dose', () => {
    const screening = {
      ...DEFAULT_SCREENING_PROFILE,
      adaptiveState: {
        ...DEFAULT_SCREENING_PROFILE.adaptiveState,
        issueScores: { upper_crossed: 5, scapular_control: 2 },
        painByExercise: {},
        performanceDrops: ['bench-press'],
        improvingIssues: ['scapular_control'],
        moduleDose: { upper_crossed: 'boost', scapular_control: 'taper' },
        lastUpdated: '2026-04-24',
      },
    };

    const modules = selectCorrectionModules(screening, getTemplate('push-a'), 'moderate');
    const upperCrossed = modules.find((module) => module.targetIssue === 'upper_crossed');
    const scapular = modules.find((module) => module.targetIssue === 'scapular_control');

    expect(upperCrossed?.dose).toBe('boost');
    expect(upperCrossed?.durationMin).toBeGreaterThanOrEqual(10);
    expect(scapular?.dose).toBe('taper');
    expect((scapular?.exercises[0].sets || 0)).toBeLessThanOrEqual(2);
  });

  it('downscales weekly budget when soreness and fatigue signals stack up', () => {
    const data = makeAppData({
      history: [
        makeSession({
          id: 's1',
          date: '2026-04-24',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [
            { weight: 60, reps: 5, rir: 0, painFlag: true },
            { weight: 60, reps: 5, rir: 0 },
            { weight: 60, reps: 5, rir: 0 },
          ],
          status: makeStatus({ sleep: '差', energy: '低', soreness: ['胸'] }),
        }),
      ],
      todayStatus: makeStatus({ sleep: '差', energy: '低', soreness: ['胸'] }),
      screeningProfile: {
        ...DEFAULT_SCREENING_PROFILE,
        adaptiveState: {
          ...DEFAULT_SCREENING_PROFILE.adaptiveState,
          issueScores: { upper_crossed: 5 },
          painByExercise: { 'bench-press': 2 },
          performanceDrops: ['bench-press'],
          improvingIssues: [],
          moduleDose: { upper_crossed: 'boost' },
          lastUpdated: '2026-04-24',
        },
      },
    });

    const weekly = buildWeeklyPrescription(data);
    const chestBudget = weekly.muscles.find((item) => item.muscle === '胸');

    expect(chestBudget?.baseTarget).toBeGreaterThan(chestBudget?.target || 0);
    expect(chestBudget?.targetMultiplier).toBeLessThan(1);
    expect(chestBudget?.adjustmentReasons?.length).toBeGreaterThan(0);
  });
});
