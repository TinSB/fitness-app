import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { applyStatusRules } from '../src/engines/exercisePrescriptionEngine';
import { upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { getTemplate, makeSession, makeStatus } from './fixtures';

describe('exercisePrescriptionEngine', () => {
  it('reorders substitutions and locks progression when adaptive state is conservative', () => {
    const template = getTemplate('push-a');
    const history = [
      makeSession({
        id: 'pain-1',
        date: '2026-04-23',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 6, rir: 1, painFlag: true },
          { weight: 60, reps: 6, rir: 1 },
          { weight: 60, reps: 6, rir: 1 },
        ],
      }),
    ];

    const screening = {
      ...DEFAULT_SCREENING_PROFILE,
      restrictedExercises: ['bench-press'],
      adaptiveState: {
        ...DEFAULT_SCREENING_PROFILE.adaptiveState,
        issueScores: { upper_crossed: 5, scapular_control: 4 },
        painByExercise: { 'bench-press': 2 },
        performanceDrops: ['bench-press'],
        improvingIssues: [],
        moduleDose: { upper_crossed: 'boost', scapular_control: 'boost' },
        lastUpdated: '2026-04-24',
      },
    };

    const adjusted = applyStatusRules(template, makeStatus({ sleep: '差', energy: '低', time: '60' }), 'hybrid', null, history, screening);
    const bench = adjusted.exercises.find((exercise: any) => exercise.id === 'bench-press');

    expect(bench?.progressLocked).toBe(true);
    expect(bench?.conservativeTopSet).toBe(true);
    expect(bench?.replacementSuggested).toBe('器械推胸');
    expect(bench?.alternatives?.[0]).toBe('器械推胸');
  });

  it('switches to a lower-volume floor version when sleep is poor and time is short', () => {
    const template = getTemplate('push-a');
    const adjusted = applyStatusRules(template, makeStatus({ sleep: '差', energy: '中', time: '30' }), 'hybrid', null, [], DEFAULT_SCREENING_PROFILE);

    expect(adjusted.exercises.length).toBeLessThanOrEqual(4);
    expect(adjusted.duration).toBe(30);
    expect(adjusted.exercises.every((exercise: any) => Number(exercise.sets) <= 2)).toBe(true);
  });

  it('uses repeated too-heavy load feedback to make the next recommendation conservative', () => {
    const template = getTemplate('push-a');
    const history = [0, 1].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `load-heavy-${index}`,
          date: `2026-04-2${index}`,
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
        }),
        'bench-press',
        'too_heavy'
      )
    );

    const adjusted = applyStatusRules(template, makeStatus({ sleep: '好', energy: '高', time: '60' }), 'hybrid', null, history, DEFAULT_SCREENING_PROFILE);
    const bench = adjusted.exercises.find((exercise: any) => exercise.id === 'bench-press');
    expect(bench?.progressLocked).toBe(true);
    expect(bench?.conservativeTopSet).toBe(true);
    expect(bench?.adjustment).toContain('推荐重量偏重');
  });
});
