import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { makeAppData } from './fixtures';

const now = '2026-04-29T12:00:00.000Z';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'coach-action',
  title: overrides.title || '生成训练量调整草案',
  description: overrides.description || '训练量建议需要查看。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'create_plan_adjustment_preview',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? true,
  reversible: overrides.reversible ?? true,
  createdAt: overrides.createdAt || now,
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '近期训练记录提示可以复查训练量。',
});

const makeDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: overrides.id || 'draft-1',
  createdAt: overrides.createdAt || now,
  status: overrides.status || 'ready_to_apply',
  sourceProgramTemplateId: overrides.sourceProgramTemplateId || 'program-hypertrophy-support',
  sourceTemplateId: overrides.sourceTemplateId || 'pull-a',
  sourceRecommendationId: overrides.sourceRecommendationId || 'coach-action-volume-preview-back-increase',
  experimentalTemplateName: overrides.experimentalTemplateName || '拉 A 实验版',
  title: overrides.title || '背部训练量调整草案',
  summary: overrides.summary || '给背部小幅增加训练量，应用前需要确认。',
  selectedRecommendationIds: overrides.selectedRecommendationIds || ['coach-action-volume-preview-back-increase'],
  changes: overrides.changes || [
    {
      id: 'change-1',
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
  confidence: overrides.confidence || 'medium',
  riskLevel: overrides.riskLevel || 'low',
  explanation: overrides.explanation || '增加幅度较小，建议观察一周。',
  notes: overrides.notes || [],
});

const rawVisibleTerms = [
  'hypertrophy',
  'hybrid',
  'strength',
  'fat_loss',
  'high',
  'medium',
  'low',
  'warmup',
  'working',
  'support',
  'compound',
  'isolation',
  'machine',
  'undefined',
  'null',
];

const visibleTextFromPlan = (vm: ReturnType<typeof buildPlanViewModel>) =>
  [
    vm.currentPlan.templateName,
    vm.currentPlan.phaseLabel,
    vm.currentPlan.trainingModeLabel,
    vm.currentPlan.weeklyFocus,
    vm.currentPlan.experimentStatus,
    ...vm.weeklySchedule.days.flatMap((day) => [day.name, day.focus, ...day.primaryExercises]),
    vm.coachInbox.summary,
    ...vm.coachInbox.visibleItems.flatMap((action) => [
      action.title,
      action.description,
      action.sourceLabel,
      action.priorityLabel,
      action.statusLabel,
      action.primaryLabel,
      action.secondaryLabel,
      action.detailLabel,
    ]),
    ...vm.adjustmentDrafts.drafts.flatMap((draft) => [
      draft.title,
      draft.summary,
      draft.statusLabel,
      draft.riskLabel,
      draft.createdAtLabel,
      draft.primaryChangeSummary,
    ]),
    vm.adjustmentDrafts.emptyState,
    vm.sideSummary.currentTemplate,
    vm.sideSummary.experimentStatus,
    vm.templateStateLabel,
    ...vm.sections,
  ]
    .filter(Boolean)
    .join(' ');

const expectNoRawVisibleTerms = (text: string) => {
  rawVisibleTerms.forEach((term) => {
    expect(text).not.toMatch(new RegExp(`(^|[^A-Za-z_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z_]|$)`));
  });
};

describe('planPresenter', () => {
  it('outputs currentPlan with localized labels', () => {
    const vm = buildPlanViewModel(makeAppData({ selectedTemplateId: 'legs-a', activeProgramTemplateId: 'legs-a' }));

    expect(vm.currentPlan.templateName).toBe('腿 A');
    expect(vm.currentPlan.phaseLabel).toContain('第');
    expect(vm.currentPlan.trainingModeLabel).toBe('综合');
    expect(vm.currentPlan.weeklyFocus).toContain('本周重点');
    expect(vm.sideSummary.currentTemplate).toBe('腿 A');
  });

  it('outputs weeklySchedule by merging program day templates and training templates', () => {
    const vm = buildPlanViewModel(makeAppData());

    expect(vm.weeklySchedule.days.length).toBeGreaterThan(0);
    expect(vm.weeklySchedule.days[0]).toMatchObject({
      name: '推 A',
      focus: expect.stringContaining('胸'),
      durationMin: expect.any(Number),
      exerciseCount: expect.any(Number),
    });
    expect(vm.weeklySchedule.days[0].primaryExercises).toContain('平板卧推');
  });

  it('merges multiple training-volume coach actions into one inbox item', () => {
    const vm = buildPlanViewModel(makeAppData(), {
      coachActions: [
        makeAction({ id: 'volume-back', targetId: 'back', targetType: 'muscle', description: '背部训练量建议。' }),
        makeAction({ id: 'volume-chest', targetId: 'chest', targetType: 'muscle', description: '胸部训练量建议。' }),
        makeAction({
          id: 'plateau-bench',
          source: 'plateau',
          actionType: 'review_exercise',
          title: '查看卧推进展',
          description: '卧推进展放缓，建议查看动作记录。',
          targetId: 'bench-press',
          targetType: 'exercise',
          requiresConfirmation: false,
          reversible: false,
        }),
      ],
    });

    const volumeItems = vm.coachInbox.visibleItems.filter((action) => action.sourceLabel === '训练量');
    expect(volumeItems).toHaveLength(1);
    expect(volumeItems[0].title).toBe('训练量建议');
    expect(volumeItems[0].description).toContain('背、胸');
    expect(volumeItems[0].primaryLabel).toBe('生成调整草案');
    expect(volumeItems[0].primaryVariant).toBe('primary');
    expect(volumeItems[0].detailItems?.map((item) => item.label)).toEqual(['背', '胸']);
    expect(vm.coachInbox.summary).toBe('系统发现 3 条计划相关建议，其中 1 条需要确认。');
  });

  it('returns an empty state when there is no real adjustment draft', () => {
    const vm = buildPlanViewModel(makeAppData());

    expect(vm.adjustmentDrafts.drafts).toHaveLength(0);
    expect(vm.adjustmentDrafts.emptyState).toContain('生成草案后');
  });

  it('includes only real drafts in adjustmentDrafts', () => {
    const vm = buildPlanViewModel(
      makeAppData({
        programAdjustmentDrafts: [
          makeDraft({ id: 'recommendation-only', status: 'recommendation', title: '建议，不是草案' }),
          makeDraft({ id: 'ready-draft', status: 'ready_to_apply' }),
        ],
      }),
    );

    expect(vm.adjustmentDrafts.drafts).toHaveLength(1);
    expect(vm.adjustmentDrafts.drafts[0].id).toBe('ready-draft');
    expect(vm.adjustmentDrafts.drafts[0].statusLabel).toBe('待确认');
  });

  it('does not expose raw enum, undefined, or null in visible presenter text', () => {
    const vm = buildPlanViewModel(
      makeAppData({
        selectedTemplateId: 'legs-a',
        activeProgramTemplateId: 'legs-a',
        programAdjustmentDrafts: [makeDraft()],
      }),
      {
        coachActions: [makeAction({ id: 'volume-back', targetId: 'back', targetType: 'muscle' })],
      },
    );

    expectNoRawVisibleTerms(visibleTextFromPlan(vm));
  });
});
