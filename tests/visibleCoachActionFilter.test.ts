import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { dismissCoachActionToday, filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';

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
  reason: '背部有效组低于目标。',
  sourceFingerprint: 'coach-action|volume|back|pull-a',
};

const makeDraft = (status: ProgramAdjustmentDraft['status'], id = `draft-${status}`): ProgramAdjustmentDraft => ({
  id,
  createdAt: '2026-05-01T10:00:00.000Z',
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceRecommendationId: 'coach-action-volume-preview-back-increase',
  sourceFingerprint: action.sourceFingerprint,
  experimentalProgramTemplateId: status === 'applied' || status === 'rolled_back' ? 'pull-a-experiment-draft' : undefined,
  experimentalTemplateName: '拉 A 实验版',
  appliedAt: status === 'applied' || status === 'rolled_back' ? '2026-05-01T10:10:00.000Z' : undefined,
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T10:20:00.000Z' : undefined,
  title: '拉 A 下周实验调整',
  summary: '生成实验调整预览。',
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
  appliedAt: '2026-05-01T10:10:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-draft',
  sourceCoachActionId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  sourceProgramTemplateName: '拉 A',
  experimentalProgramTemplateName: '拉 A 实验版',
  mainChangeSummary: '背部增加 1 组',
  selectedRecommendationIds: [action.id],
  changes: makeDraft('applied').changes,
  status,
  rollbackAvailable: status !== 'rolled_back',
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T10:20:00.000Z' : undefined,
});

describe('visible CoachAction filter', () => {
  it('hides same-source actions while a ready draft exists', () => {
    const visible = filterVisibleCoachActions([action], [makeDraft('ready_to_apply')], [], [], '2026-05-01');

    expect(visible).toHaveLength(0);
  });

  it('hides same-source actions after an applied draft or history item', () => {
    const byDraft = filterVisibleCoachActions([action], [makeDraft('applied')], [], [], '2026-05-01');
    const byHistory = filterVisibleCoachActions([action], [], [makeHistory('applied')], [], '2026-05-01');

    expect(byDraft).toHaveLength(0);
    expect(byHistory).toHaveLength(0);
  });

  it('allows a rolled-back same-source action to reappear unless a new ready draft exists', () => {
    const rolledBack = makeDraft('rolled_back');
    const readyChild = { ...makeDraft('ready_to_apply', 'draft-after-rollback'), parentDraftId: rolledBack.id, draftRevision: 2 };

    expect(filterVisibleCoachActions([action], [rolledBack], [makeHistory('rolled_back')], [], '2026-05-01')).toEqual([action]);
    expect(filterVisibleCoachActions([action], [readyChild, rolledBack], [makeHistory('rolled_back')], [], '2026-05-01')).toHaveLength(0);
  });

  it('dismisses only for the current day and keeps original actions intact', () => {
    const dismissed = [dismissCoachActionToday(action.id, '2026-05-01T11:00:00.000Z')];

    expect(filterVisibleCoachActions([action], [], [], dismissed, '2026-05-01')).toHaveLength(0);
    expect(filterVisibleCoachActions([action], [], [], dismissed, '2026-05-02')).toEqual([action]);
    expect(action.status).toBe('pending');
  });
});
