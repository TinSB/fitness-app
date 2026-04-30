import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { filterResolvedPlanActions } from '../src/engines/coachActionDismissEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations, rollbackAdjustment } from '../src/engines/programAdjustmentEngine';
import { buildRegeneratedPlanAdjustmentDraft } from '../src/engines/planAdjustmentIdentityEngine';
import type { ProgramAdjustmentDraft, WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

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

const makeAction = (sourceFingerprint: string): CoachAction => {
  const seed: CoachAction = {
    id: 'volume-preview-back-increase',
    title: '生成训练量调整草案',
    description: '背部训练量低于目标，可以重新考虑下周调整草案。',
    source: 'volumeAdaptation',
    actionType: 'create_plan_adjustment_preview',
    priority: 'medium',
    status: 'pending',
    requiresConfirmation: true,
    reversible: true,
    createdAt: '2026-05-01T09:00:00.000Z',
    targetId: 'back',
    targetType: 'muscle',
    reason: '背部有效组低于目标。',
  };
  return {
    ...seed,
    sourceFingerprint:
      sourceFingerprint ||
      buildCoachActionFingerprint(seed, {
        sourceTemplateId: 'pull-a',
        muscleId: 'back',
        suggestedChange: recommendation.suggestedChange,
      }),
  };
};

const buildAppliedAndRolledBackDraft = () => {
  const data = makeAppData({
    history: [
      makeSession({
        id: 'finished-before-rollback',
        date: '2026-04-29',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 60, reps: 10 }],
      }),
    ],
  });
  const sourceTemplate = getTemplate('pull-a');
  const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
  if (!applied.experimentalTemplate || !applied.historyItem) throw new Error('apply failed');
  const rollback = rollbackAdjustment(applied.historyItem);
  const rolledBackDraft: ProgramAdjustmentDraft = {
    ...applied.draft,
    status: 'rolled_back',
    rolledBackAt: rollback.updatedHistoryItem.rolledBackAt,
  };
  return { data, sourceTemplate, applied, rollback, rolledBackDraft };
};

describe('plan adjustment rollback reopen flow', () => {
  it('restores the source template and lets a still-valid same-source action reappear', () => {
    const { data, sourceTemplate, applied, rollback, rolledBackDraft } = buildAppliedAndRolledBackDraft();
    const action = makeAction(rolledBackDraft.sourceFingerprint || '');
    const nextData = {
      ...data,
      templates: [...data.templates, applied.experimentalTemplate!],
      activeProgramTemplateId: rollback.restoredTemplateId,
      programAdjustmentDrafts: [rolledBackDraft],
      programAdjustmentHistory: [rollback.updatedHistoryItem],
    };
    const visible = filterResolvedPlanActions(
      [action],
      nextData.programAdjustmentDrafts,
      nextData.programAdjustmentHistory,
      [],
      '2026-05-01',
    );

    expect(nextData.activeProgramTemplateId).toBe(sourceTemplate.id);
    expect(nextData.programAdjustmentDrafts[0].status).toBe('rolled_back');
    expect(nextData.programAdjustmentHistory[0].status).toBe('rolled_back');
    expect(nextData.history).toHaveLength(1);
    expect(visible).toEqual([action]);
  });

  it('regenerates a new child draft without deleting the rolled-back draft', () => {
    const { rolledBackDraft } = buildAppliedAndRolledBackDraft();
    const result = buildRegeneratedPlanAdjustmentDraft(rolledBackDraft, [rolledBackDraft], {
      now: '2026-05-01T10:00:00.000Z',
      draftId: 'draft-after-rollback',
    });
    const drafts = [result.draft!, rolledBackDraft];

    expect(result.draft?.parentDraftId).toBe(rolledBackDraft.id);
    expect(result.draft?.status).toBe('ready_to_apply');
    expect(drafts.map((draft) => draft.id)).toContain(rolledBackDraft.id);
  });

  it('does not create another draft when a regenerated ready draft already exists', () => {
    const { rolledBackDraft } = buildAppliedAndRolledBackDraft();
    const first = buildRegeneratedPlanAdjustmentDraft(rolledBackDraft, [rolledBackDraft], {
      now: '2026-05-01T10:00:00.000Z',
      draftId: 'draft-after-rollback',
    }).draft!;
    const second = buildRegeneratedPlanAdjustmentDraft(rolledBackDraft, [rolledBackDraft, first], {
      now: '2026-05-01T10:01:00.000Z',
      draftId: 'draft-after-rollback-duplicate',
    });

    expect(second.existingDraft?.id).toBe(first.id);
    expect(second.draft).toBeUndefined();
  });

  it('uses the original template for new training after rollback', () => {
    const { data, sourceTemplate, rollback } = buildAppliedAndRolledBackDraft();
    const session = createSession(
      sourceTemplate,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(rollback.restoredTemplateId).toBe(sourceTemplate.id);
    expect(session.programTemplateId).toBe(sourceTemplate.id);
    expect(session.isExperimentalTemplate).toBe(false);
    expect(session.sourceProgramTemplateId).toBeUndefined();
  });
});
