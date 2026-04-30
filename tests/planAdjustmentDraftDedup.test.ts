import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildCoachActionAdjustmentDraftInput } from '../src/engines/coachActionEngine';
import { findExistingAdjustmentForCoachAction } from '../src/engines/coachActionDismissEngine';
import { buildPlanAdjustmentFingerprintFromCoachAction } from '../src/engines/planAdjustmentIdentityEngine';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
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

const makeLinkedDraft = (status: ProgramAdjustmentDraft['status'] = 'ready_to_apply') => {
  const data = makeAppData();
  const input = buildCoachActionAdjustmentDraftInput(action, { templates: data.templates, volumeAdaptation });
  if (!input) throw new Error('missing input');
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
    ...draft,
    status,
    sourceCoachActionId: action.id,
    sourceFingerprint,
    selectedRecommendationIds: [...new Set([...draft.selectedRecommendationIds, action.id])],
  };
};

describe('plan adjustment draft dedupe', () => {
  it('finds an existing ready draft instead of creating another one', () => {
    const draft = makeLinkedDraft('ready_to_apply');
    const existing = findExistingAdjustmentForCoachAction(action, [draft], [], draft.sourceFingerprint);

    expect(existing?.state).toBe('draft_ready');
    expect(existing?.draft?.id).toBe(draft.id);
  });

  it('does not regenerate a suggestion that is already applied or already handled', () => {
    const applied = makeLinkedDraft('applied');
    const rolledBack = makeLinkedDraft('rolled_back');
    const dismissed = makeLinkedDraft('dismissed');

    expect(findExistingAdjustmentForCoachAction(action, [applied], [], applied.sourceFingerprint)?.state).toBe('applied');
    expect(findExistingAdjustmentForCoachAction(action, [rolledBack], [], rolledBack.sourceFingerprint)?.state).toBe('rolled_back');
    expect(findExistingAdjustmentForCoachAction(action, [dismissed], [], dismissed.sourceFingerprint)?.state).toBe('dismissed');
  });
});
