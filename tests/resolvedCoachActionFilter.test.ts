import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { filterResolvedPlanActions } from '../src/engines/coachActionDismissEngine';
import { buildPlanAdjustmentFingerprintFromCoachAction } from '../src/engines/planAdjustmentIdentityEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';

const makeAction = (targetId = 'back'): CoachAction => {
  const action: CoachAction = {
    id: `volume-preview-${targetId}-increase`,
    title: '生成训练量调整草案',
    description: `${targetId} 训练量偏低，可以生成下周调整草案。`,
    source: 'volumeAdaptation',
    actionType: 'create_plan_adjustment_preview',
    priority: 'medium',
    status: 'pending',
    requiresConfirmation: true,
    reversible: true,
    createdAt: '2026-04-30T12:00:00.000Z',
    targetId,
    targetType: 'muscle',
    reason: `${targetId} 有效组低于目标。`,
  };
  return {
    ...action,
    sourceFingerprint: buildPlanAdjustmentFingerprintFromCoachAction(action, {
      sourceTemplateId: 'pull-a',
      suggestedChange: { muscleId: targetId, setsDelta: 1 },
    }),
  };
};

const makeDraft = (action: CoachAction, status: ProgramAdjustmentDraft['status'] = 'ready_to_apply'): ProgramAdjustmentDraft => ({
  id: `draft-${action.targetId}-${status}`,
  createdAt: '2026-04-30T12:10:00.000Z',
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  title: '拉 A 下周实验调整',
  summary: '背部训练量调整草案。',
  selectedRecommendationIds: [action.id],
  changes: [
    {
      id: `change-${action.targetId}`,
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      muscleId: action.targetId,
      setsDelta: 1,
      reason: '有效组低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  notes: [],
});

const makeHistory = (action: CoachAction): ProgramAdjustmentHistoryItem => ({
  id: `history-${action.targetId}`,
  appliedAt: '2026-04-30T12:30:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-abc123',
  sourceCoachActionId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  selectedRecommendationIds: [action.id],
  changes: makeDraft(action).changes,
  status: 'applied',
  rollbackAvailable: true,
});

describe('resolved coach action filter', () => {
  it('hides actions that already have a draft or applied history', () => {
    const back = makeAction('back');
    const chest = makeAction('chest');

    expect(filterResolvedPlanActions([back, chest], [makeDraft(back)], [], [], '2026-04-30')).toEqual([chest]);
    expect(filterResolvedPlanActions([back, chest], [], [makeHistory(back)], [], '2026-04-30')).toEqual([chest]);
  });

  it('allows rolled back same-source drafts while hiding dismissed drafts', () => {
    const back = makeAction('back');
    const chest = makeAction('chest');

    expect(filterResolvedPlanActions([back, chest], [makeDraft(back, 'rolled_back')], [], [], '2026-04-30')).toEqual([back, chest]);
    expect(filterResolvedPlanActions([back, chest], [makeDraft(back, 'dismissed')], [], [], '2026-04-30')).toEqual([chest]);
  });

  it('also respects same-day dismiss state', () => {
    const back = makeAction('back');
    const dismissed = [{ actionId: back.id, dismissedAt: '2026-04-30T15:00:00.000Z', scope: 'today' as const }];

    expect(filterResolvedPlanActions([back], [], [], dismissed, '2026-04-30')).toHaveLength(0);
    expect(filterResolvedPlanActions([back], [], [], dismissed, '2026-05-01')).toHaveLength(1);
  });
});
