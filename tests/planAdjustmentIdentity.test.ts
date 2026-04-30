import { describe, expect, it } from 'vitest';
import { buildPlanAdjustmentFingerprint } from '../src/engines/planAdjustmentIdentityEngine';

describe('plan adjustment identity', () => {
  it('builds the same fingerprint for the same business suggestion', () => {
    const base = {
      sourceCoachActionId: 'volume-preview-back-increase',
      source: 'volumeAdaptation',
      actionType: 'create_plan_adjustment_preview',
      sourceTemplateId: 'pull-a',
      targetMuscleId: 'back',
      suggestedChangeType: 'add_sets',
      changeSummary: '背部有效组低于目标，建议下周增加训练量。',
      weekId: '2026-W18',
    };

    expect(buildPlanAdjustmentFingerprint(base)).toBe(buildPlanAdjustmentFingerprint({ ...base }));
  });

  it('separates different muscles, exercises, and source templates', () => {
    const back = buildPlanAdjustmentFingerprint({
      source: 'volumeAdaptation',
      actionType: 'create_plan_adjustment_preview',
      sourceTemplateId: 'pull-a',
      targetMuscleId: 'back',
      suggestedChangeType: 'add_sets',
      changeSummary: '有效组低于目标。',
    });
    const legs = buildPlanAdjustmentFingerprint({
      source: 'volumeAdaptation',
      actionType: 'create_plan_adjustment_preview',
      sourceTemplateId: 'legs-a',
      targetMuscleId: 'quads',
      suggestedChangeType: 'add_sets',
      changeSummary: '有效组低于目标。',
    });
    const row = buildPlanAdjustmentFingerprint({
      source: 'plateau',
      actionType: 'create_plan_adjustment_preview',
      sourceTemplateId: 'pull-a',
      targetExerciseId: 'barbell-row',
      suggestedChangeType: 'remove_sets',
      changeSummary: '动作进展放缓。',
    });

    expect(new Set([back, legs, row]).size).toBe(3);
  });

  it('does not use draft id, random value, or Date.now in the fingerprint', () => {
    const fingerprint = buildPlanAdjustmentFingerprint({
      sourceCoachActionId: 'volume-preview-back-increase',
      source: 'volumeAdaptation',
      actionType: 'create_plan_adjustment_preview',
      sourceTemplateId: 'pull-a',
      targetMuscleId: 'back',
      suggestedChangeType: 'add_sets',
      changeSummary: '背部有效组低于目标。',
    });

    expect(fingerprint).not.toContain('draft-123');
    expect(fingerprint).not.toContain('random');
    expect(fingerprint).not.toContain(String(Date.now()));
  });
});
