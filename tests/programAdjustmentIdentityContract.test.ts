import { describe, expect, it } from 'vitest';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import { buildPlanAdjustmentFingerprintFromDraft } from '../src/engines/planAdjustmentIdentityEngine';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const recommendation: WeeklyActionRecommendation = {
  id: 'coach-action-volume-preview-back-increase',
  priority: 'medium',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: '背',
  issue: '背部训练量不足',
  recommendation: '下周给背部小幅增加 1 组。',
  reason: '背部近期有效组不足，且完成率良好。',
  suggestedChange: {
    muscleId: 'back',
    setsDelta: 1,
    exerciseIds: ['lat-pulldown'],
  },
  confidence: 'medium',
};

const buildDraft = () => {
  const data = makeAppData();
  return createAdjustmentDraftFromRecommendations([recommendation], getTemplate('pull-a'), {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
};

describe('program adjustment identity contract', () => {
  it('keeps sourceFingerprint and CoachAction draft instance id stable for identical input', () => {
    const first = buildDraft();
    const second = buildDraft();

    expect(first.id).toBe(second.id);
    expect(first.id).toMatch(/^adjustment-draft-/);
    expect(buildPlanAdjustmentFingerprintFromDraft(first)).toBe(buildPlanAdjustmentFingerprintFromDraft(second));
    expect(buildPlanAdjustmentFingerprintFromDraft(first)).not.toMatch(/\d{10,}|random|undefined|null/);
  });

  it('uses deterministic change ids for identical recommendation input', () => {
    const first = buildDraft();
    const second = buildDraft();

    expect(first.changes.map((change) => change.id)).toEqual(second.changes.map((change) => change.id));
    expect(first.changes[0]?.id).toContain(recommendation.id);
  });
});
