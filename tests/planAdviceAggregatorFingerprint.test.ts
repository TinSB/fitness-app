import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { aggregatePlanAdvice } from '../src/presenters/planAdviceAggregator';

const makeAction = (targetId = 'back'): CoachAction => {
  const seed: CoachAction = {
    id: `runtime-${targetId}`,
    title: '生成训练量调整草案',
    description: `${targetId} 训练量低于目标，可以生成下周调整草案。`,
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
  return { ...seed, sourceFingerprint: buildCoachActionFingerprint(seed, { sourceTemplateId: 'pull-a', muscleId: targetId, suggestedChangeType: 'add_sets' }) };
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

describe('Plan advice aggregator fingerprint dedupe', () => {
  it('filters pending actions when the same sourceFingerprint already has a draft', () => {
    const action = makeAction('back');
    const advice = aggregatePlanAdvice([action], null, [makeDraft(action)]);

    expect(advice.filter((item) => item.category !== 'draft')).toHaveLength(0);
    expect(advice.filter((item) => item.category === 'draft')).toHaveLength(1);
  });

  it('does not use a rolled-back draft to suppress a still-valid pending action', () => {
    const action = makeAction('back');
    const advice = aggregatePlanAdvice([action], null, [makeDraft(action, 'rolled_back')]);

    expect(advice.some((item) => item.category === 'volume')).toBe(true);
    expect(advice.some((item) => item.category === 'draft' && item.status === 'rolled_back')).toBe(true);
  });

  it('shows only one draft for duplicate legacy entries with the same fingerprint, preferring applied', () => {
    const action = makeAction('back');
    const ready = makeDraft(action, 'ready_to_apply');
    const applied = { ...makeDraft(action, 'applied'), id: 'draft-applied', appliedAt: '2026-04-30T13:00:00.000Z' };
    const advice = aggregatePlanAdvice([], null, [ready, applied]);
    const draftAdvice = advice.filter((item) => item.category === 'draft');

    expect(draftAdvice).toHaveLength(1);
    expect(draftAdvice[0].status).toBe('applied');
  });

  it('does not expose raw enum, undefined, or null in visible advice text', () => {
    const action = makeAction('back');
    const advice = aggregatePlanAdvice([action], null, [makeDraft(action)]);
    const text = advice
      .flatMap((item) => [
        item.title,
        item.summary,
        item.primaryAction?.label,
        ...(item.secondaryActions || []).map((secondary) => secondary.label),
        ...item.affectedItems.flatMap((affected) => [affected.label, affected.summary]),
      ])
      .filter(Boolean)
      .join('\n');

    expect(text).not.toMatch(/\b(undefined|null|create_plan_adjustment_preview|volumeAdaptation|ready_to_apply|medium|low|high)\b/);
  });
});
