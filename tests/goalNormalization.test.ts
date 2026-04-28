import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { applyStatusRules } from '../src/engines/progressionEngine';
import { resolveMode } from '../src/engines/engineUtils';
import { sanitizeData } from '../src/storage/persistence';
import { getTemplate, makeStatus } from './fixtures';

describe('goal normalization', () => {
  it('normalizes legacy hypertrophy goal aliases during persistence sanitize', () => {
    const fromMuscleGain = sanitizeData({
      trainingMode: 'muscle_gain',
      userProfile: { primaryGoal: '增肌' },
      programTemplate: { primaryGoal: '肌肥大' },
      history: [],
    });

    expect(fromMuscleGain.trainingMode).toBe('hypertrophy');
    expect(fromMuscleGain.userProfile.primaryGoal).toBe('hypertrophy');
    expect(fromMuscleGain.programTemplate.primaryGoal).toBe('hypertrophy');
  });

  it('maps hypertrophy aliases to the same mode metadata', () => {
    expect(resolveMode('增肌').id).toBe('hypertrophy');
    expect(resolveMode('肌肥大').id).toBe('hypertrophy');
    expect(resolveMode('muscleGrowth').id).toBe('hypertrophy');
  });

  it('keeps recommendations identical for hypertrophy aliases', () => {
    const template = getTemplate('push-a');
    const status = makeStatus();
    const byMuscleGain = applyStatusRules(template, status, '增肌', null, [], DEFAULT_SCREENING_PROFILE);
    const byHypertrophy = applyStatusRules(template, status, '肌肥大', null, [], DEFAULT_SCREENING_PROFILE);

    expect(byMuscleGain.exercises.map((exercise) => [exercise.id, exercise.repMin, exercise.repMax])).toEqual(
      byHypertrophy.exercises.map((exercise) => [exercise.id, exercise.repMin, exercise.repMax])
    );
  });
});
