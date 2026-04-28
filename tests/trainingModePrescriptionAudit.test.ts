import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { auditGoalModeConsistency } from '../src/engines/goalConsistencyEngine';
import { applyStatusRules, buildSetPrescription, makeSuggestion } from '../src/engines/progressionEngine';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

const tricepsFrom = (mode: 'hypertrophy' | 'hybrid' | 'strength') => {
  const plan = applyStatusRules(getTemplate('push-a'), makeStatus(), mode, null, [], DEFAULT_SCREENING_PROFILE);
  const exercise = plan.exercises.find((item) => item.id === 'triceps-pushdown');
  if (!exercise) throw new Error('Missing triceps-pushdown');
  return exercise;
};

describe('training mode prescription audit', () => {
  it('keeps hypertrophy isolation rep range broad without forcing the upper bound at baseline', () => {
    const triceps = tricepsFrom('hypertrophy');
    const suggestion = makeSuggestion(triceps, []);
    const prescription = buildSetPrescription(triceps, suggestion);

    expect(triceps.repMin).toBe(10);
    expect(triceps.repMax).toBe(20);
    expect(suggestion.reps).toBe(triceps.repMin);
    expect(prescription.summary).toContain('10-20');
  });

  it('keeps hybrid mode distinct from pure hypertrophy and pure strength', () => {
    const hypertrophy = tricepsFrom('hypertrophy');
    const hybrid = tricepsFrom('hybrid');
    const strength = tricepsFrom('strength');

    expect(hybrid.repMax).toBeLessThan(hypertrophy.repMax);
    expect(hybrid.repMin).toBeGreaterThanOrEqual(strength.repMin);
    expect(strength.repMin).toBeGreaterThanOrEqual(8);
  });

  it('does not treat fat_loss + hybrid as hypertrophy', () => {
    const audit = auditGoalModeConsistency(
      makeAppData({
        trainingMode: 'hybrid',
        userProfile: { ...makeAppData().userProfile, primaryGoal: 'fat_loss' },
        mesocyclePlan: { ...makeAppData().mesocyclePlan, primaryGoal: 'hypertrophy' },
      })
    );

    expect(audit.primaryGoal).toBe('fat_loss');
    expect(audit.trainingMode).toBe('hybrid');
    expect(audit.mesocycleGoal).toBe('fat_loss_support');
  });
});
