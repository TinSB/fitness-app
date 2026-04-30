import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import {
  filterResolvedPlanActions,
  findExistingAdjustmentForCoachAction,
} from '../src/engines/coachActionDismissEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';

const makeAction = (): CoachAction => {
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
    createdAt: '2026-04-30T12:00:00.000Z',
    targetId: 'back',
    targetType: 'muscle',
    reason: '背部有效组低于目标。',
  };
  return {
    ...seed,
    sourceFingerprint: buildCoachActionFingerprint(seed, {
      sourceTemplateId: 'pull-a',
      muscleId: 'back',
      suggestedChangeType: 'add_sets',
    }),
  };
};

const makeDraft = (action: CoachAction, status: ProgramAdjustmentDraft['status']): ProgramAdjustmentDraft => ({
  id: `draft-${status}`,
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
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      muscleId: 'back',
      setsDelta: 1,
      reason: '有效组低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  notes: [],
});

const makeHistory = (action: CoachAction, rolledBack = false): ProgramAdjustmentHistoryItem => ({
  id: rolledBack ? 'history-rolled-back' : 'history-applied',
  appliedAt: '2026-04-30T12:30:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-abc123',
  sourceCoachActionId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  selectedRecommendationIds: [action.id],
  changes: makeDraft(action, 'applied').changes,
  status: rolledBack ? 'rolled_back' : 'applied',
  rollbackAvailable: !rolledBack,
  rolledBackAt: rolledBack ? '2026-04-30T13:00:00.000Z' : undefined,
});

describe('coach action rollback filter', () => {
  it('does not permanently hide same-source actions after rollback', () => {
    const action = makeAction();
    const visible = filterResolvedPlanActions([action], [makeDraft(action, 'rolled_back')], [], [], '2026-04-30');

    expect(visible).toEqual([action]);
    expect(findExistingAdjustmentForCoachAction(action, [makeDraft(action, 'rolled_back')], [])?.state).toBe('rolled_back');
  });

  it('still hides same-source actions while a ready draft exists', () => {
    const action = makeAction();
    const visible = filterResolvedPlanActions(
      [action],
      [makeDraft(action, 'rolled_back'), makeDraft(action, 'ready_to_apply')],
      [],
      [],
      '2026-04-30',
    );

    expect(visible).toHaveLength(0);
  });

  it('still hides applied and dismissed suggestions', () => {
    const action = makeAction();

    expect(filterResolvedPlanActions([action], [makeDraft(action, 'applied')], [], [], '2026-04-30')).toHaveLength(0);
    expect(filterResolvedPlanActions([action], [makeDraft(action, 'dismissed')], [], [], '2026-04-30')).toHaveLength(0);
  });

  it('allows rolled-back history while applied history remains resolved', () => {
    const action = makeAction();

    expect(filterResolvedPlanActions([action], [], [makeHistory(action, true)], [], '2026-04-30')).toEqual([action]);
    expect(filterResolvedPlanActions([action], [], [makeHistory(action, false)], [], '2026-04-30')).toHaveLength(0);
  });

  it('respects same-day dismiss after the rolled-back action reappears', () => {
    const action = makeAction();
    const dismissed = [{ actionId: action.id, dismissedAt: '2026-04-30T15:00:00.000Z', scope: 'today' as const }];

    expect(filterResolvedPlanActions([action], [makeDraft(action, 'rolled_back')], [], dismissed, '2026-04-30')).toHaveLength(0);
    expect(filterResolvedPlanActions([action], [makeDraft(action, 'rolled_back')], [], dismissed, '2026-05-01')).toEqual([action]);
  });
});
