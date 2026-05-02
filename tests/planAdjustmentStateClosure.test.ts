import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { findExistingAdjustmentForCoachAction, filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import { buildRegeneratedPlanAdjustmentDraft } from '../src/engines/planAdjustmentIdentityEngine';
import { aggregatePlanAdvice } from '../src/presenters/planAdviceAggregator';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';

const sourceFingerprint = 'coach-action|volume-adaptation|create-plan-adjustment-preview|muscle|back|pull-a';

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
  createdAt: '2026-05-01T09:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部有效组低于目标。',
  sourceFingerprint,
};

const makeDraft = (status: ProgramAdjustmentDraft['status'], id = `draft-${status}`): ProgramAdjustmentDraft => ({
  id,
  parentDraftId: undefined,
  draftRevision: 1,
  createdAt: '2026-05-01T09:05:00.000Z',
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceRecommendationId: 'coach-action-volume-preview-back-increase',
  sourceFingerprint,
  experimentalProgramTemplateId: status === 'applied' || status === 'rolled_back' ? 'pull-a-experiment-draft' : undefined,
  experimentalTemplateName: '拉 A 实验版',
  appliedAt: status === 'applied' || status === 'rolled_back' ? '2026-05-01T09:20:00.000Z' : undefined,
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T09:40:00.000Z' : undefined,
  title: '拉 A 下周实验调整',
  summary: '基于教练建议生成实验调整预览。',
  selectedRecommendationIds: [action.id],
  changes: [
    {
      id: 'change-back-volume',
      type: 'add_sets',
      muscleId: 'back',
      exerciseId: 'lat-pulldown',
      setsDelta: 1,
      reason: '背部训练量低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '根据近期训练记录生成。',
  notes: [],
});

const makeHistory = (status: ProgramAdjustmentHistoryItem['status'] = 'applied'): ProgramAdjustmentHistoryItem => ({
  id: `history-${status}`,
  appliedAt: '2026-05-01T09:20:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-draft',
  sourceCoachActionId: action.id,
  sourceFingerprint,
  sourceProgramTemplateName: '拉 A',
  experimentalProgramTemplateName: '拉 A 实验版',
  mainChangeSummary: '背部增加 1 组',
  selectedRecommendationIds: [action.id],
  changes: makeDraft('applied').changes,
  status,
  explanation: '根据近期训练记录生成。',
  rollbackAvailable: status !== 'rolled_back',
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T09:40:00.000Z' : undefined,
});

describe('plan adjustment state closure', () => {
  it('uses sourceFingerprint as the draft state machine key', () => {
    const ready = makeDraft('ready_to_apply');
    const applied = makeDraft('applied');

    expect(findExistingAdjustmentForCoachAction(action, [ready], [], sourceFingerprint)?.state).toBe('draft_ready');
    expect(findExistingAdjustmentForCoachAction(action, [applied], [makeHistory('applied')], sourceFingerprint)?.state).toBe('applied');
  });

  it('does not show pending advice while a same-source draft is ready or applied', () => {
    expect(filterVisibleCoachActions([action], [makeDraft('ready_to_apply')], [], [], '2026-05-01')).toHaveLength(0);
    expect(filterVisibleCoachActions([action], [makeDraft('applied')], [makeHistory('applied')], [], '2026-05-01')).toHaveLength(0);
  });

  it('reopens rolled-back advice and labels the Plan inbox action as regeneration', () => {
    const rolledBack = makeDraft('rolled_back');
    const visible = filterVisibleCoachActions([action], [rolledBack], [makeHistory('rolled_back')], [], '2026-05-01');
    const advice = aggregatePlanAdvice(visible, null, [rolledBack]);

    expect(visible).toEqual([action]);
    expect(advice.find((item) => item.category === 'volume')?.primaryAction?.label).toBe('重新生成草案');
    expect(advice.find((item) => item.category === 'volume')?.primaryAction?.variant).toBe('primary');
  });

  it('regenerates a child draft once and keeps the rolled-back draft as history', () => {
    const rolledBack = makeDraft('rolled_back');
    const first = buildRegeneratedPlanAdjustmentDraft(rolledBack, [rolledBack], {
      now: '2026-05-01T10:00:00.000Z',
    });
    const second = buildRegeneratedPlanAdjustmentDraft(rolledBack, [rolledBack, first.draft!], {
      now: '2026-05-01T10:01:00.000Z',
    });

    expect(first.draft?.id).toBe(`${rolledBack.id}-r2`.replace(/^/, 'adjustment-draft-'));
    expect(first.draft?.parentDraftId).toBe(rolledBack.id);
    expect(first.draft?.sourceFingerprint).toBe(sourceFingerprint);
    expect(first.draft?.status).toBe('ready_to_apply');
    expect(second.existingDraft?.id).toBe(first.draft?.id);
    expect(second.draft).toBeUndefined();
    expect(JSON.stringify([rolledBack, first.draft])).not.toMatch(/\bundefined|null\b/);
  });
});
