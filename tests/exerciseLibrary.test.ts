import { describe, expect, it } from 'vitest';
import { EXERCISE_KNOWLEDGE_OVERRIDES } from '../src/data/exerciseLibrary';

const contributionOf = (exerciseId: string) =>
  EXERCISE_KNOWLEDGE_OVERRIDES[exerciseId]?.muscleContribution as Record<string, number> | undefined;

describe('exerciseLibrary muscleContribution', () => {
  it('covers representative horizontal push, pull, squat, hinge and isolation exercises', () => {
    expect(contributionOf('bench-press')).toMatchObject({ 胸: 1, 手臂: 0.5, 肩: 0.4 });
    expect(contributionOf('seated-row')).toMatchObject({ 背: 1, 手臂: 0.4 });
    expect(contributionOf('squat')).toMatchObject({ 腿: 1 });
    expect(contributionOf('romanian-deadlift')).toMatchObject({ 腿: 1, 背: 0.5 });
    expect(contributionOf('lateral-raise')).toMatchObject({ 肩: 1 });
    expect(contributionOf('triceps-pushdown')).toMatchObject({ 手臂: 1 });
  });

  it('keeps contribution weights in the 0-1 estimate range', () => {
    Object.values(EXERCISE_KNOWLEDGE_OVERRIDES).forEach((override) => {
      const contribution = override.muscleContribution as Record<string, number> | undefined;
      if (!contribution) return;
      Object.values(contribution).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });
});
