import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';
import { buildCoachActionView } from '../src/presenters/coachActionPresenter';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
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

const draft = (status: ProgramAdjustmentDraft['status']): ProgramAdjustmentDraft => ({
  id: `draft-${status}`,
  createdAt: '2026-04-30T12:00:00.000Z',
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceRecommendationId: `coach-action-${action.id}`,
  sourceFingerprint: 'coach-action|create-plan-adjustment-preview|volume-adaptation|muscle|back|pull-a',
  title: '拉 A 下周实验调整',
  summary: '背部训练量调整草案。',
  selectedRecommendationIds: [`coach-action-${action.id}`, action.id],
  changes: [
    {
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部有效组低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  notes: [],
});

const historyItem: ProgramAdjustmentHistoryItem = {
  id: 'history-1',
  appliedAt: '2026-04-30T13:00:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-1',
  sourceCoachActionId: action.id,
  sourceFingerprint: 'coach-action|create-plan-adjustment-preview|volume-adaptation|muscle|back|pull-a',
  selectedRecommendationIds: [`coach-action-${action.id}`, action.id],
  changes: draft('applied').changes,
  status: 'applied',
  rollbackAvailable: true,
};

describe('CoachAction applied state filtering', () => {
  it('filters same-source actions when a ready draft already exists', () => {
    const visible = filterVisibleCoachActions([action], [draft('ready_to_apply')], [], [], '2026-04-30');

    expect(visible).toEqual([]);
  });

  it('filters same-source actions after a draft is applied', () => {
    const visible = filterVisibleCoachActions([action], [draft('applied')], [], [], '2026-04-30');

    expect(visible).toEqual([]);
  });

  it('filters same-source actions from adjustment history even if the draft is missing', () => {
    const visible = filterVisibleCoachActions([action], [], [historyItem], [], '2026-04-30');

    expect(visible).toEqual([]);
  });

  it('keeps unrelated pending actions visible', () => {
    const unrelated = { ...action, id: 'volume-preview-chest-increase', targetId: 'chest' };
    const visible = filterVisibleCoachActions([action, unrelated], [draft('applied')], [], [], '2026-04-30');

    expect(visible.map((item) => item.id)).toEqual(['volume-preview-chest-increase']);
  });

  it('keeps applied same-source actions out of the Plan pending inbox', () => {
    const vm = buildPlanViewModel(makeAppData({ programAdjustmentDrafts: [draft('applied')] }), {
      coachActions: [action],
    });

    expect(vm.coachInbox.visibleItems).toHaveLength(0);
    expect(vm.adjustmentDrafts.drafts[0]?.statusLabel).toBe('已应用');
  });

  it('labels an applied create-draft action as viewing the experimental template', () => {
    const view = buildCoachActionView({ ...action, status: 'applied' });

    expect(view.primaryLabel).toBe('查看实验模板');
  });
});
