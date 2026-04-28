import { describe, expect, it } from 'vitest';
import { auditGoalModeConsistency, normalizePrimaryGoal, normalizeTrainingMode } from '../src/engines/goalConsistencyEngine';
import { applyStatusRules } from '../src/engines/progressionEngine';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

describe('goalConsistencyEngine', () => {
  it('normalizes hypertrophy aliases to one canonical goal', () => {
    expect(normalizePrimaryGoal('增肌')).toBe('hypertrophy');
    expect(normalizePrimaryGoal('肌肥大')).toBe('hypertrophy');
    expect(normalizePrimaryGoal('hypertrophy')).toBe('hypertrophy');
    expect(normalizePrimaryGoal('muscle_gain')).toBe('hypertrophy');
    expect(normalizePrimaryGoal('muscleGrowth')).toBe('hypertrophy');
  });

  it('keeps fat_loss + hybrid as a legal combination', () => {
    const result = auditGoalModeConsistency(
      makeAppData({
        trainingMode: 'hybrid',
        userProfile: { ...makeAppData().userProfile, primaryGoal: 'fat_loss' },
        mesocyclePlan: { ...makeAppData().mesocyclePlan, primaryGoal: 'hypertrophy' },
      })
    );

    expect(result.primaryGoal).toBe('fat_loss');
    expect(result.trainingMode).toBe('hybrid');
    expect(result.mesocycleGoal).toBe('fat_loss_support');
    expect(result.isConsistent).toBe(true);
    expect(result.explanation).toContain('减脂');
    expect(result.explanation).toContain('保肌');
  });

  it('normalizes training mode aliases without treating hybrid as strength', () => {
    expect(normalizeTrainingMode('综合')).toBe('hybrid');
    expect(normalizeTrainingMode('hybrid')).toBe('hybrid');
    expect(normalizeTrainingMode('力量')).toBe('strength');
    expect(normalizeTrainingMode('muscle_gain')).toBe('hypertrophy');
  });

  it('keeps hypertrophy aliases on the same prescription branch', () => {
    const template = getTemplate('push-a');
    const status = makeStatus();
    const byMuscleGain = applyStatusRules(template, status, 'muscle_gain', null, [], DEFAULT_SCREENING_PROFILE);
    const byHypertrophy = applyStatusRules(template, status, '肌肥大', null, [], DEFAULT_SCREENING_PROFILE);

    expect(byMuscleGain.exercises.map((exercise) => [exercise.id, exercise.repMin, exercise.repMax])).toEqual(
      byHypertrophy.exercises.map((exercise) => [exercise.id, exercise.repMin, exercise.repMax])
    );
  });
});
