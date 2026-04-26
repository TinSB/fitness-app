import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { buildAdaptiveDeloadDecision, buildAdaptiveState } from '../src/engines/adaptiveFeedbackEngine';
import { makeAppData, makeSession, makeStatus } from './fixtures';

describe('adaptiveFeedbackEngine', () => {
  it('marks issue scores and boosts module dose when pain and performance drops accumulate', () => {
    const history = [
      makeSession({
        id: 'recent',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 5, rir: 0, painFlag: true },
          { weight: 60, reps: 5, rir: 0 },
          { weight: 60, reps: 5, rir: 0 },
        ],
      }),
      makeSession({
        id: 'middle',
        date: '2026-04-20',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, painFlag: true },
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
        ],
      }),
      makeSession({
        id: 'older',
        date: '2026-04-16',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
        ],
      }),
    ];

    const adaptiveState = buildAdaptiveState(history, DEFAULT_SCREENING_PROFILE);
    expect(adaptiveState.painByExercise['bench-press']).toBeGreaterThanOrEqual(2);
    expect(adaptiveState.performanceDrops).toContain('bench-press');
    expect(Number(adaptiveState.issueScores.upper_crossed)).toBeGreaterThan(0);
    expect(adaptiveState.moduleDose.upper_crossed).toBe('boost');
  });

  it('escalates to a red deload decision when fatigue signals stack', () => {
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
        makeSession({
          id: 's2',
          date: '2026-04-21',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [
            { weight: 60, reps: 6, rir: 1, painFlag: true },
            { weight: 60, reps: 6, rir: 1 },
            { weight: 60, reps: 6, rir: 1 },
          ],
          status: makeStatus({ sleep: '差', energy: '低', soreness: ['胸'] }),
        }),
      ],
      todayStatus: makeStatus({ sleep: '差', energy: '低', soreness: ['胸', '背'] }),
      screeningProfile: {
        ...DEFAULT_SCREENING_PROFILE,
        adaptiveState: {
          ...DEFAULT_SCREENING_PROFILE.adaptiveState,
          issueScores: { upper_crossed: 5, scapular_control: 4 },
          painByExercise: { 'bench-press': 2 },
          performanceDrops: ['bench-press', 'lat-pulldown'],
          improvingIssues: [],
          moduleDose: { upper_crossed: 'boost' },
          lastUpdated: '2026-04-24',
        },
      },
    });

    const decision = buildAdaptiveDeloadDecision(data);
    expect(decision.level).toBe('red');
    expect(decision.strategy).toBe('recovery_template');
    expect(decision.autoSwitchTemplateId).toBe('quick-30');
  });
});
