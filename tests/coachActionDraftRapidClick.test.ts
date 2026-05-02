import { describe, expect, it } from 'vitest';
import { buildCoachActionAdjustmentDraftInput, type CoachAction } from '../src/engines/coachActionEngine';
import { buildPlanAdjustmentFingerprintFromCoachAction, upsertPlanAdjustmentDraftByFingerprint } from '../src/engines/planAdjustmentIdentityEngine';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import type { AppData } from '../src/models/training-model';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { makeAppData } from './fixtures';

const volumeAdaptation: VolumeAdaptationReport = {
  summary: '背部建议小幅增加训练量。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 1,
      title: '背：增加训练量',
      reason: '背部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 1 组。'],
    },
  ],
};

const action: CoachAction = {
  id: 'volume-preview-back-increase',
  title: '生成训练量调整草案',
  description: '背部训练量偏低，可以生成下周调整草案。',
  source: 'volumeAdaptation',
  actionType: 'create_plan_adjustment_preview',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: '2026-05-01T10:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部有效组低于目标，且近期完成率良好。',
};

const buildCandidateDraft = (data: AppData, idSuffix: string) => {
  const input = buildCoachActionAdjustmentDraftInput(action, {
    templates: data.templates,
    volumeAdaptation,
  });
  if (!input) throw new Error('expected draft input');
  const sourceFingerprint = buildPlanAdjustmentFingerprintFromCoachAction(action, {
    sourceTemplateId: input.sourceTemplate.id,
    suggestedChange: input.recommendation.suggestedChange,
  });
  const draft = createAdjustmentDraftFromRecommendations([input.recommendation], input.sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  return {
    sourceFingerprint,
    draft: {
      ...draft,
      id: `${draft.id}-${idSuffix}`,
      sourceCoachActionId: action.id,
      sourceRecommendationId: input.recommendation.id,
      sourceFingerprint,
      selectedRecommendationIds: [...new Set([...(draft.selectedRecommendationIds || []), input.recommendation.id, action.id])],
    },
  };
};

describe('CoachAction draft rapid click guard', () => {
  it('keeps only one active draft for two rapid same-source preview requests', () => {
    const data = makeAppData();
    const firstCandidate = buildCandidateDraft(data, 'rapid-a');
    const first = upsertPlanAdjustmentDraftByFingerprint([], [], firstCandidate.draft, firstCandidate.sourceFingerprint);
    const secondCandidate = buildCandidateDraft(data, 'rapid-b');
    const second = upsertPlanAdjustmentDraftByFingerprint(first.drafts, [], secondCandidate.draft, secondCandidate.sourceFingerprint);

    expect(second.outcome).toBe('opened_existing');
    expect(second.drafts).toHaveLength(1);
    expect(second.drafts[0]).toMatchObject({
      sourceCoachActionId: action.id,
      sourceFingerprint: firstCandidate.sourceFingerprint,
      status: 'ready_to_apply',
    });
    expect(second.drafts[0].id).not.toContain('rapid-b');
  });
});
