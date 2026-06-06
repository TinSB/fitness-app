// planAdviceAggregator is a pure formatter: given the same coach actions +
// volume report + drafts, it returns a deterministic ranked AggregatedPlanAdvice[].
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { aggregatePlanAdvice } from '../src/presenters/planAdviceAggregator';
import type { CoachAction } from '../src/engines/coachActionEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';

const now = '2026-05-27T12:00:00.000Z';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'a1',
  title: overrides.title || '查看建议',
  description: overrides.description || '查看建议，不会自动修改。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || now,
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '基于近期记录。',
});

const volume: VolumeAdaptationReport = {
  summary: '背低于目标。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 2,
      title: '背 增加',
      reason: '背低于目标。',
      confidence: 'medium',
      suggestedActions: ['+2 组'],
    },
  ],
};

describe('trainingDecisionHardRewritePlanAggregator', () => {
  it('produces deterministic ranked output for identical input', () => {
    const action = makeAction({ id: 'back-action', targetId: 'back', targetType: 'muscle' });
    const a = aggregatePlanAdvice([action], volume, []);
    const b = aggregatePlanAdvice([action], volume, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('emits a volume advice for matching coach actions + volume report', () => {
    const action = makeAction({ id: 'back-action', targetId: 'back', targetType: 'muscle' });
    const advice = aggregatePlanAdvice([action], volume, []);
    expect(advice.some((item) => item.category === 'volume')).toBe(true);
  });

  it('returns empty list when no actions and no volume signals', () => {
    const advice = aggregatePlanAdvice([], null, []);
    expect(advice).toEqual([]);
  });

  it('dedups drafts by fingerprint into the draft category', () => {
    const draft: ProgramAdjustmentDraft = {
      id: 'd-1',
      createdAt: now,
      status: 'ready_to_apply',
      sourceProgramTemplateId: 'push-a',
      sourceCoachActionId: 'a1',
      title: 'push 调整',
      summary: '+2 组。',
      selectedRecommendationIds: ['a1'],
      changes: [{ id: 'c1', type: 'add_sets', dayTemplateId: 'push-a', setsDelta: 2 }],
    } as ProgramAdjustmentDraft;
    const advice = aggregatePlanAdvice([], null, [draft]);
    expect(advice.filter((a) => a.category === 'draft').length).toBe(1);
  });
});
