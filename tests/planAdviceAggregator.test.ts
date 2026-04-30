import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { aggregatePlanAdvice } from '../src/presenters/planAdviceAggregator';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';

const now = '2026-04-30T12:00:00.000Z';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'coach-action',
  title: overrides.title || '查看计划建议',
  description: overrides.description || '查看计划建议，不会自动修改计划。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || now,
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '根据近期训练记录生成。',
});

const volumeReport: VolumeAdaptationReport = {
  summary: '背、腿、胸建议小幅增加。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 2,
      title: '背：增加训练量',
      reason: '背部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 2 组。'],
    },
    {
      muscleId: 'legs',
      decision: 'increase',
      setsDelta: 1,
      title: '腿：增加训练量',
      reason: '腿部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 1 组。'],
    },
    {
      muscleId: 'chest',
      decision: 'increase',
      setsDelta: 2,
      title: '胸：增加训练量',
      reason: '胸部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 2 组。'],
    },
  ],
};

const makeDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: overrides.id || 'draft-back',
  createdAt: now,
  status: overrides.status || 'ready_to_apply',
  sourceProgramTemplateId: 'program-hypertrophy-support',
  sourceTemplateId: 'pull-a',
  sourceRecommendationId: overrides.sourceRecommendationId || 'volume-preview-back',
  experimentalTemplateName: '拉 A 实验版',
  title: '背部训练量调整草案',
  summary: '背部近期有效组不足，应用前需要确认。',
  selectedRecommendationIds: overrides.selectedRecommendationIds || ['volume-preview-back'],
  changes: overrides.changes || [
    {
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      dayTemplateName: '拉 A',
      exerciseId: 'lat-pulldown',
      exerciseName: '高位下拉',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部近期有效组不足，且完成率良好。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '增加 1 组，建议观察一周。',
  notes: [],
  ...overrides,
});

const visibleText = (items: ReturnType<typeof aggregatePlanAdvice>) =>
  items
    .flatMap((item) => [
      item.title,
      item.summary,
      item.primaryAction?.label,
      ...(item.affectedItems || []).flatMap((affected) => [affected.label, affected.summary]),
    ])
    .join(' ');

describe('planAdviceAggregator', () => {
  it('merges three muscle increase suggestions into one volume advice', () => {
    const advice = aggregatePlanAdvice(
      [
        makeAction({
          id: 'volume-preview-back',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'back',
          targetType: 'muscle',
          requiresConfirmation: true,
          reversible: true,
        }),
      ],
      volumeReport,
      [],
    );
    const volume = advice.find((item) => item.category === 'volume');

    expect(volume).toBeTruthy();
    expect(volume?.title).toBe('训练量建议');
    expect(volume?.summary).toContain('背、腿、胸低于目标');
    expect(volume?.affectedItems.map((item) => item.label)).toEqual(['背', '腿', '胸']);
    expect(volume?.primaryAction?.label).toBe('生成调整草案');
    expect(volume?.primaryAction?.variant).toBe('primary');
  });

  it('deduplicates repeated actionType and targetId', () => {
    const advice = aggregatePlanAdvice([
      makeAction({ id: 'volume-review-back-a', actionType: 'review_volume', targetId: 'back', targetType: 'muscle' }),
      makeAction({ id: 'volume-review-back-b', actionType: 'review_volume', targetId: 'back', targetType: 'muscle' }),
    ]);
    const volume = advice.find((item) => item.category === 'volume');

    expect(volume?.affectedItems).toHaveLength(1);
    expect(volume?.sourceActionIds).toHaveLength(1);
  });

  it('removes matching draft-generation suggestions after a draft exists', () => {
    const advice = aggregatePlanAdvice(
      [
        makeAction({
          id: 'volume-preview-back',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'back',
          targetType: 'muscle',
          requiresConfirmation: true,
          reversible: true,
        }),
      ],
      volumeReport,
      [makeDraft()],
    );
    const pendingVolume = advice.find((item) => item.category === 'volume');
    const draft = advice.find((item) => item.category === 'draft');

    expect(pendingVolume?.affectedItems.map((item) => item.label)).toEqual(['腿', '胸']);
    expect(pendingVolume?.primaryAction?.label).not.toBe('生成调整草案');
    expect(draft?.title).toBe('背部训练量调整草案');
  });

  it('groups plateau advice instead of rendering one card per exercise', () => {
    const advice = aggregatePlanAdvice([
      makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', targetId: 'bench-press', targetType: 'exercise', title: '查看卧推进展' }),
      makeAction({ id: 'plateau-row', source: 'plateau', actionType: 'review_exercise', targetId: 'barbell-row', targetType: 'exercise', title: '查看划船进展' }),
    ]);
    const plateau = advice.find((item) => item.category === 'plateau');

    expect(plateau?.title).toBe('动作进展建议');
    expect(plateau?.affectedItems).toHaveLength(2);
    expect(advice.filter((item) => item.category === 'plateau')).toHaveLength(1);
  });

  it('keeps visible copy localized and free of raw enum tokens', () => {
    const advice = aggregatePlanAdvice(
      [
        makeAction({
          id: 'volume-preview-back',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'back',
          targetType: 'muscle',
          requiresConfirmation: true,
          reversible: true,
        }),
      ],
      volumeReport,
      [],
    );

    expect(visibleText(advice)).not.toMatch(/\b(undefined|null|increase|medium|low|high|review_volume|create_plan_adjustment_preview|volumeAdaptation|plateau)\b/);
  });
});
