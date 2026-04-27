import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { createSession } from '../src/engines/sessionBuilder';
import { getTemplate, makeSession, makeStatus } from './fixtures';

describe('sessionBuilder', () => {
  it('builds a more conservative session when fatigue and pain are elevated', () => {
    const template = getTemplate('push-a');
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
        status: makeStatus({ sleep: '差', energy: '低', soreness: ['胸'] }),
      }),
      makeSession({
        id: 'older',
        date: '2026-04-20',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, painFlag: true },
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
        ],
        status: makeStatus({ sleep: '差', energy: '低', soreness: ['胸'] }),
      }),
    ];

    const session = createSession(
      template,
      makeStatus({ sleep: '差', energy: '低', soreness: ['胸'], time: '30' }),
      history,
      'hybrid',
      null,
      null,
      {
        ...DEFAULT_SCREENING_PROFILE,
        restrictedExercises: ['bench-press'],
        adaptiveState: {
          ...DEFAULT_SCREENING_PROFILE.adaptiveState,
          issueScores: { upper_crossed: 5, scapular_control: 4 },
          painByExercise: { 'bench-press': 2 },
          performanceDrops: ['bench-press'],
          improvingIssues: [],
          moduleDose: { upper_crossed: 'boost' },
          lastUpdated: '2026-04-24',
        },
      }
    );

    expect(session.deloadDecision?.level).not.toBe('none');
    expect(session.durationMin).toBeLessThanOrEqual(35);
    expect(session.exercises[0]?.progressLocked).toBe(true);
    expect(session.explanations?.length).toBeGreaterThan(0);
    expect(session.programTemplateId).toBe(template.id);
    expect(session.programTemplateName).toBeTruthy();
  });
});
