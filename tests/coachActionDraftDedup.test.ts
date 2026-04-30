import { describe, expect, it } from 'vitest';
import {
  buildCoachActionAdjustmentDraftInput,
  type CoachAction,
} from '../src/engines/coachActionEngine';
import { findExistingAdjustmentForCoachAction } from '../src/engines/coachActionDismissEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { makeAppData } from './fixtures';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'volume-preview-back-increase',
  title: overrides.title || '生成训练量调整草案',
  description: overrides.description || '背部训练量偏低，可以生成下周调整草案。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'create_plan_adjustment_preview',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? true,
  reversible: overrides.reversible ?? true,
  createdAt: overrides.createdAt || '2026-04-30T12:00:00.000Z',
  targetId: Object.prototype.hasOwnProperty.call(overrides, 'targetId') ? overrides.targetId : 'back',
  targetType: Object.prototype.hasOwnProperty.call(overrides, 'targetType') ? overrides.targetType : 'muscle',
  reason: overrides.reason || '背部有效组低于目标，且近期完成率良好。',
});

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

const makeDraftFromAction = (action = makeAction(), status: ProgramAdjustmentDraft['status'] = 'ready_to_apply') => {
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
  const baseDraft = createAdjustmentDraftFromRecommendations([draftInput.recommendation], draftInput.sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  return {
    ...baseDraft,
    status,
    sourceCoachActionId: action.id,
    sourceFingerprint,
    selectedRecommendationIds: [...new Set([...baseDraft.selectedRecommendationIds, draftInput.recommendation.id, action.id])],
  };
};

describe('CoachAction draft dedupe', () => {
  it('links a CoachAction to a ready draft by sourceCoachActionId and sourceFingerprint', () => {
    const action = makeAction();
    const draft = makeDraftFromAction(action);
    const existing = findExistingAdjustmentForCoachAction(action, [draft], [], draft.sourceFingerprint);

    expect(existing?.state).toBe('draft_ready');
    expect(existing?.draft?.id).toBe(draft.id);
    expect(draft.sourceCoachActionId).toBe(action.id);
    expect(draft.sourceFingerprint).toContain('coach-action');
  });

  it('treats an applied same-source draft as already handled', () => {
    const action = makeAction();
    const draft = makeDraftFromAction(action, 'applied');
    const existing = findExistingAdjustmentForCoachAction(action, [draft], [], draft.sourceFingerprint);

    expect(existing?.state).toBe('applied');
    expect(existing?.draft?.status).toBe('applied');
  });

  it('treats dismissed or expired same-source drafts as already handled by default', () => {
    const action = makeAction();
    const dismissed = makeDraftFromAction(action, 'dismissed');
    const expired = makeDraftFromAction(action, 'expired');

    expect(findExistingAdjustmentForCoachAction(action, [dismissed], [], dismissed.sourceFingerprint)?.state).toBe('dismissed');
    expect(findExistingAdjustmentForCoachAction(action, [expired], [], expired.sourceFingerprint)?.state).toBe('expired');
  });
});
