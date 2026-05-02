import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import {
  buildCoachActionAdjustmentDraftInput,
} from '../src/engines/coachActionEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations, rollbackAdjustment } from '../src/engines/programAdjustmentEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { makeAppData } from './fixtures';

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
  createdAt: '2026-04-30T12:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部有效组低于目标。',
};

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

const makeLinkedDraft = () => {
  const data = makeAppData();
  const draftInput = buildCoachActionAdjustmentDraftInput(action, {
    templates: data.templates,
    volumeAdaptation,
  });
  if (!draftInput) throw new Error('Missing draft input');
  const sourceFingerprint = buildCoachActionFingerprint(action, {
    sourceTemplateId: draftInput.sourceTemplate.id,
    suggestedChange: draftInput.recommendation.suggestedChange,
  });
  const draft = createAdjustmentDraftFromRecommendations([draftInput.recommendation], draftInput.sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  return {
    data,
    sourceTemplate: draftInput.sourceTemplate,
    draft: {
      ...draft,
      sourceCoachActionId: action.id,
      sourceFingerprint,
      selectedRecommendationIds: [...new Set([...draft.selectedRecommendationIds, draftInput.recommendation.id, action.id])],
    },
  };
};

describe('plan adjustment state sync', () => {
  it('applies a linked draft and carries source identity into draft and history', () => {
    const { data, sourceTemplate, draft } = makeLinkedDraft();
    const result = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);

    expect(result.ok).toBe(true);
    expect(result.draft.status).toBe('applied');
    expect(result.draft.appliedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(result.draft.experimentalProgramTemplateId).toBe(result.experimentalTemplate?.id);
    expect(result.draft.sourceCoachActionId).toBe(action.id);
    expect(result.draft.sourceFingerprint).toBe(draft.sourceFingerprint);
    expect(result.historyItem?.sourceCoachActionId).toBe(action.id);
    expect(result.historyItem?.sourceFingerprint).toBe(draft.sourceFingerprint);
    expect(result.historyItem?.selectedRecommendationIds).toContain(action.id);
  });

  it('rolls back without deleting the applied history item identity', () => {
    const { data, sourceTemplate, draft } = makeLinkedDraft();
    const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
    if (!applied.historyItem) throw new Error('Missing history item');

    const rollback = rollbackAdjustment(applied.historyItem);

    expect(rollback.restoredTemplateId).toBe(sourceTemplate.id);
    expect(rollback.updatedHistoryItem.status).toBe('rolled_back');
    expect(rollback.updatedHistoryItem.sourceCoachActionId).toBe(action.id);
    expect(rollback.updatedHistoryItem.sourceFingerprint).toBe(draft.sourceFingerprint);
  });
});
