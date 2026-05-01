import { describe, expect, it } from 'vitest';
import { dismissCoachActionToday, filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import { applySessionPatches, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { createSession } from '../src/engines/sessionBuilder';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'volume-back-preview',
  title: overrides.title || '生成调整草案',
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
  sourceFingerprint: overrides.sourceFingerprint,
});

const makeDraft = (action: CoachAction, status: ProgramAdjustmentDraft['status']): ProgramAdjustmentDraft =>
  ({
    id: `draft-${status}`,
    status,
    title: '下周训练量调整草案',
    summary: '背部增加 1 组。',
    sourceProgramTemplateId: 'program-hypertrophy-support',
    sourceTemplateId: 'pull-a',
    sourceCoachActionId: action.id,
    sourceFingerprint: action.sourceFingerprint || buildCoachActionFingerprint(action, { sourceTemplateId: 'program-hypertrophy-support' }),
    selectedRecommendationIds: [action.id],
    changes: [{ type: 'add_sets', muscleId: 'back', setsDelta: 1, reason: '背部训练量偏低。' }],
    riskLevel: 'low',
    explanation: '背部训练量偏低，先小幅增加。',
    createdAt: '2026-04-30T12:00:00.000Z',
    experimentalTemplateName: '拉 A 下周实验调整',
  }) as ProgramAdjustmentDraft;

describe('engine idempotency', () => {
  it('builds stable CoachAction fingerprints from business fields', () => {
    const action = makeAction();
    const first = buildCoachActionFingerprint(action, { sourceTemplateId: 'program-hypertrophy-support' });
    const second = buildCoachActionFingerprint({ ...action, id: 'different-render-id' }, { sourceTemplateId: 'program-hypertrophy-support' });
    const chest = buildCoachActionFingerprint({ ...action, targetId: 'chest' }, { sourceTemplateId: 'program-hypertrophy-support' });

    expect(first).toBe(second);
    expect(chest).not.toBe(first);
    expect(first).not.toMatch(/\bundefined|null\b/);
  });

  it('filters active or applied draft sources but lets rolled back advice return', () => {
    const action = { ...makeAction(), sourceFingerprint: 'coach-action|volume|back' };

    expect(filterVisibleCoachActions([action], [makeDraft(action, 'ready_to_apply')], [], [], '2026-04-30')).toEqual([]);
    expect(filterVisibleCoachActions([action], [makeDraft(action, 'applied')], [], [], '2026-04-30')).toEqual([]);
    expect(filterVisibleCoachActions([action], [makeDraft(action, 'rolled_back')], [], [], '2026-04-30')).toEqual([action]);
  });

  it('dismisses only same-day visible action without deleting the original source action', () => {
    const action = makeAction({ id: 'action-one' });
    const other = makeAction({ id: 'action-two', targetId: 'chest' });
    const dismissed = dismissCoachActionToday(action.id, '2026-04-30T13:00:00.000Z');
    const actions = [action, other];

    expect(filterVisibleCoachActions(actions, [], [], [dismissed], '2026-04-30').map((item) => item.id)).toEqual(['action-two']);
    expect(filterVisibleCoachActions(actions, [], [], [dismissed], '2026-05-01').map((item) => item.id)).toEqual([
      'action-one',
      'action-two',
    ]);
    expect(actions).toHaveLength(2);
  });

  it('does not apply the same pending session patch twice', () => {
    const data = makeAppData();
    const session = createSession(
      getTemplate('pull-a'),
      data.todayStatus,
      [],
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    const patch: SessionPatch = {
      id: 'session-patch-reduce-support',
      type: 'reduce_support',
      title: '减少辅助训练',
      description: '本次训练减少辅助内容。',
      reason: '今日恢复压力较高。',
      reversible: true,
    };

    const first = applySessionPatches(session, [patch]);
    const second = applySessionPatches(first.session, [patch]);

    expect(first.appliedPatches).toHaveLength(1);
    expect(second.appliedPatches).toHaveLength(0);
    expect(second.warnings.join('\n')).toMatch(/[\u4e00-\u9fff]/);
  });
});
