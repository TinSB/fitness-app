import { describe, expect, it } from 'vitest';
import { buildSetPrescription, makeSuggestion } from '../src/engines/progressionRulesEngine';
import { getTemplate, makeSession } from './fixtures';

describe('progressionRulesEngine', () => {
  it('adds weight only after two consecutive ceiling sessions', () => {
    const template = getTemplate('push-a');
    const bench = template.exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('bench-press missing');

    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
        ],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-21',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
          { weight: 60, reps: 8, rir: 2 },
        ],
      }),
    ];

    const suggestion = makeSuggestion(bench, history);
    expect(suggestion.weight).toBe(62.5);
    expect(suggestion.note).toContain('连续两次');
  });

  it('backs off when recent performance falls below the floor', () => {
    const template = getTemplate('legs-a');
    const squat = template.exercises.find((exercise) => exercise.id === 'squat');
    if (!squat) throw new Error('squat missing');

    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [
          { weight: 80, reps: 4, rir: 0 },
          { weight: 80, reps: 4, rir: 0 },
          { weight: 80, reps: 4, rir: 0 },
          { weight: 80, reps: 4, rir: 0 },
        ],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-18',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [
          { weight: 80, reps: 7, rir: 2 },
          { weight: 80, reps: 7, rir: 2 },
          { weight: 80, reps: 6, rir: 2 },
          { weight: 80, reps: 6, rir: 2 },
        ],
      }),
    ];

    const suggestion = makeSuggestion(squat, history);
    expect(suggestion.weight).toBe(75);
    expect(suggestion.note).toContain('退回');
  });

  it('builds a conservative top-set/back-off prescription when adaptive factors are present', () => {
    const template = getTemplate('push-a');
    const bench = template.exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('bench-press missing');

    const prescription = buildSetPrescription(
      {
        ...bench,
        conservativeTopSet: true,
        adaptiveTopSetFactor: 0.96,
        adaptiveBackoffFactor: 0.88,
      },
      {
        weight: 80,
        reps: 6,
      }
    );

    expect(prescription.topWeight).toBeLessThan(80);
    expect(prescription.backoffWeight).toBeLessThan(prescription.topWeight);
    expect(prescription.summary).toContain('保守版');
  });

  it('poor technique prevents load increase', () => {
    const template = getTemplate('push-a');
    const bench = template.exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('bench-press missing');

    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'poor' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'poor' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'poor' },
        ],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-21',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
        ],
      }),
    ];

    const suggestion = makeSuggestion(bench, history);
    expect(suggestion.weight).toBe(60);
    expect(suggestion.note).toContain('动作质量');
  });

  it('good technique allows progression when reps and rir meet target', () => {
    const template = getTemplate('push-a');
    const bench = template.exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('bench-press missing');

    const history = [
      makeSession({
        id: 's1',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
        ],
      }),
      makeSession({
        id: 's2',
        date: '2026-04-21',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
          { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
        ],
      }),
    ];

    const suggestion = makeSuggestion(bench, history);
    expect(suggestion.weight).toBe(62.5);
  });
});
