import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import {
  buildProgramAdjustmentPreview,
  buildWeeklyActionRecommendations,
  recommendExercisesForMuscleGap,
} from '../src/engines/weeklyCoachActionEngine';
import type { MuscleVolumeDashboardRow, PainPattern } from '../src/models/training-model';

const row = (overrides: Partial<MuscleVolumeDashboardRow>): MuscleVolumeDashboardRow => ({
  muscleId: '背',
  muscleName: '背',
  targetSets: 12,
  completedSets: 5,
  effectiveSets: 4,
  highConfidenceEffectiveSets: 4,
  weightedEffectiveSets: 4,
  remainingSets: 8,
  status: 'low',
  notes: [],
  ...overrides,
});

describe('weeklyCoachActionEngine', () => {
  it('generates a back volume recommendation when back is under target', () => {
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '背', muscleName: '背', status: 'low', weightedEffectiveSets: 5, targetSets: 12, remainingSets: 7 })],
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    });

    const volume = actions.find((item) => item.category === 'volume' && item.targetId === '背');
    expect(volume?.priority).toBe('high');
    expect(volume?.recommendation).toMatch(/补|下周/);
    expect(volume?.suggestedChange?.setsDelta).toBeGreaterThanOrEqual(2);
    expect(volume?.suggestedChange?.exerciseIds?.length).toBeGreaterThan(0);
  });

  it('generates maintain guidance when chest is near target', () => {
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '胸', muscleName: '胸', status: 'near_target', weightedEffectiveSets: 9, targetSets: 10, remainingSets: 1 })],
    });

    const action = actions.find((item) => item.targetId === '胸');
    expect(action?.recommendation).toContain('维持');
    expect(action?.suggestedChange?.setsDelta).toBe(0);
  });

  it('recommends reducing or not adding volume when legs are high', () => {
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '腿', muscleName: '腿', status: 'high', weightedEffectiveSets: 18, targetSets: 12, remainingSets: 0 })],
    });

    const action = actions.find((item) => item.targetId === '腿');
    expect(action?.recommendation).toMatch(/不建议|减少|维持/);
    expect(action?.suggestedChange?.setsDelta).toBeLessThan(0);
  });

  it('does not create aggressive catch-up volume during a deload week', () => {
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '背', muscleName: '背', status: 'low', weightedEffectiveSets: 4, targetSets: 12, remainingSets: 8 })],
      mesocycleWeek: { weekIndex: 3, phase: 'deload', volumeMultiplier: 0.6, intensityBias: 'conservative' },
    });

    const action = actions[0];
    expect(action.category).toBe('mesocycle');
    expect(action.recommendation).toContain('不强行补量');
    expect(action.suggestedChange?.setsDelta).toBe(0);
  });

  it('prioritizes technique quality when completed sets are high but high-confidence sets are low', () => {
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '肩', muscleName: '肩', status: 'on_target', completedSets: 10, effectiveSets: 8, highConfidenceEffectiveSets: 2, weightedEffectiveSets: 8, targetSets: 8, remainingSets: 0 })],
    });

    const technique = actions.find((item) => item.category === 'technique');
    expect(technique?.recommendation).toMatch(/动作质量|RIR/);
    expect(technique?.suggestedChange?.setsDelta).toBe(0);
  });

  it('does not recommend exercises with substitute or professional pain actions', () => {
    const painPatterns: PainPattern[] = [
      {
        area: '肩',
        exerciseId: 'bench-press',
        frequency: 3,
        severityAvg: 5,
        lastOccurredAt: '2026-04-25',
        suggestedAction: 'substitute',
      },
    ];

    const recommendations = recommendExercisesForMuscleGap('胸', {
      painPatterns,
      restrictedExercises: ['machine-chest-press'],
    });

    expect(recommendations.find((item) => item.exerciseId === 'bench-press')?.priority).toBe('avoid');
    expect(recommendations.find((item) => item.exerciseId === 'machine-chest-press')?.priority).toBe('avoid');
    expect(recommendations.some((item) => item.priority === 'primary')).toBe(true);
  });

  it('converts recommendations into a non-mutating program preview', () => {
    const original = JSON.stringify(DEFAULT_PROGRAM_TEMPLATE);
    const actions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [row({ muscleId: '背', muscleName: '背', status: 'low', weightedEffectiveSets: 4, targetSets: 12, remainingSets: 8 })],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    });
    const previews = buildProgramAdjustmentPreview(actions, DEFAULT_PROGRAM_TEMPLATE);

    expect(previews[0]?.changes.some((change) => change.type === 'add_sets')).toBe(true);
    expect(JSON.stringify(DEFAULT_PROGRAM_TEMPLATE)).toBe(original);
  });

  it('returns low-confidence keep preview when no actionable change exists', () => {
    const previews = buildProgramAdjustmentPreview([], DEFAULT_PROGRAM_TEMPLATE);
    expect(previews[0]?.changes[0]?.type).toBe('keep');
    expect(previews[0]?.confidence).toBe('low');
  });
});
