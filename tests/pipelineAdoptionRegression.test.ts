import { describe, expect, it } from 'vitest';
import { dismissCoachActionToday } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import { buildDerivedStateInvalidation, type AppMutationEvent } from '../src/engines/derivedStateInvalidationEngine';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { createSession } from '../src/engines/sessionBuilder';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem, TrainingTemplate } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string) => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
});

const makePlanAction = (overrides: Partial<CoachAction> = {}): CoachAction => {
  const base: CoachAction = {
    id: overrides.id || 'volume-back-draft',
    title: overrides.title || '生成训练量调整草案',
    description: overrides.description || '背部训练量低于目标，可以生成下周调整草案。',
    source: overrides.source || 'volumeAdaptation',
    actionType: overrides.actionType || 'create_plan_adjustment_preview',
    priority: overrides.priority || 'medium',
    status: overrides.status || 'pending',
    requiresConfirmation: overrides.requiresConfirmation ?? true,
    reversible: overrides.reversible ?? true,
    createdAt: overrides.createdAt || '2026-04-30T12:00:00.000Z',
    targetId: Object.prototype.hasOwnProperty.call(overrides, 'targetId') ? overrides.targetId : 'back',
    targetType: Object.prototype.hasOwnProperty.call(overrides, 'targetType') ? overrides.targetType : 'muscle',
    reason: overrides.reason || '背部近期有效组偏低，建议复查下周训练量。',
  };
  const sourceFingerprint =
    overrides.sourceFingerprint ||
    buildCoachActionFingerprint(base, {
      sourceTemplateId: 'pull-a',
      suggestedChangeType: 'add_sets',
      muscleId: 'back',
    });
  return { ...base, ...overrides, sourceFingerprint };
};

const makeDraft = (
  action = makePlanAction(),
  status: ProgramAdjustmentDraft['status'] = 'ready_to_apply',
): ProgramAdjustmentDraft => ({
  id: `draft-${status}-${action.id}`,
  createdAt: '2026-04-30T12:10:00.000Z',
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceRecommendationId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  experimentalProgramTemplateId: status === 'applied' || status === 'rolled_back' ? 'pull-a-experiment' : undefined,
  experimentalTemplateName: '拉 A 下周实验调整',
  appliedAt: status === 'applied' ? '2026-04-30T12:20:00.000Z' : undefined,
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T12:20:00.000Z' : undefined,
  title: '拉 A 下周实验调整',
  summary: '背部训练量低于目标，建议小幅增加。',
  selectedRecommendationIds: [action.id],
  changes: [
    {
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部近期有效组偏低。',
      sourceRecommendationId: action.id,
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '小幅增加 1 组，应用前需要确认。',
  notes: [],
});

const makeHistoryItem = (
  action = makePlanAction(),
  status: ProgramAdjustmentHistoryItem['status'] = 'applied',
): ProgramAdjustmentHistoryItem => ({
  id: `history-${status}-${action.id}`,
  appliedAt: '2026-04-30T12:20:00.000Z',
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment',
  sourceCoachActionId: action.id,
  sourceFingerprint: action.sourceFingerprint,
  selectedRecommendationIds: [action.id],
  changes: makeDraft(action, status === 'rolled_back' ? 'rolled_back' : 'applied').changes,
  status,
  rollbackAvailable: status !== 'rolled_back',
  rolledBackAt: status === 'rolled_back' ? '2026-05-01T12:20:00.000Z' : undefined,
  mainChangeSummary: '背部增加 1 组',
});

const experimentalTemplate = (): TrainingTemplate => ({
  ...getTemplate('pull-a'),
  id: 'pull-a-experiment',
  name: '拉 A 下周实验调整',
  isExperimentalTemplate: true,
  sourceTemplateId: 'pull-a',
  sourceTemplateName: getTemplate('pull-a').name,
  appliedAt: '2026-04-30T12:20:00.000Z',
  adjustmentSummary: '背部增加 1 组',
});

describe('pipeline adoption regression', () => {
  it('feeds the same cycle-aware next workout into Today and Plan presenters', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const data = makeAppData({ history, selectedTemplateId: 'legs-a' });
    const pipeline = buildEnginePipeline(data, '2026-04-30', { coachActions: [] });
    const todayViewModel = buildTodayViewModel({
      todayState: pipeline.todayState,
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: '拉 A',
      activeTemplateName: '拉 A',
      nextSuggestion: getTemplate('legs-a'),
      nextWorkout: pipeline.nextWorkout,
    });
    const planViewModel = buildPlanViewModel(data, { coachActions: pipeline.visibleCoachActions });

    expect(pipeline.nextWorkout.templateId).toBe('push-a');
    expect(todayViewModel.nextSuggestion.templateId).toBe('push-a');
    expect(todayViewModel.nextSuggestion.templateName).not.toContain('腿');
    expect(planViewModel.coachInbox.visibleItems).toHaveLength(0);
  });

  it('uses one visible CoachAction filter for dismiss, draft-ready, applied, and rolled-back states', () => {
    const action = makePlanAction();
    const plain = buildEnginePipeline(makeAppData(), '2026-04-30', { coachActions: [action] });
    const withReadyDraft = buildEnginePipeline(
      makeAppData({ programAdjustmentDrafts: [makeDraft(action, 'ready_to_apply')] }),
      '2026-04-30',
      { coachActions: [action] },
    );
    const withAppliedDraft = buildEnginePipeline(
      makeAppData({ programAdjustmentDrafts: [makeDraft(action, 'applied')], programAdjustmentHistory: [makeHistoryItem(action, 'applied')] }),
      '2026-04-30',
      { coachActions: [action] },
    );
    const withRolledBackDraft = buildEnginePipeline(
      makeAppData({ programAdjustmentDrafts: [makeDraft(action, 'rolled_back')], programAdjustmentHistory: [makeHistoryItem(action, 'rolled_back')] }),
      '2026-05-02',
      { coachActions: [action] },
    );
    const dismissedToday = buildEnginePipeline(
      makeAppData({ dismissedCoachActions: [dismissCoachActionToday(action.id, '2026-04-30T13:00:00.000Z')] }),
      '2026-04-30',
      { coachActions: [action] },
    );
    const dismissedTomorrow = buildEnginePipeline(
      makeAppData({ dismissedCoachActions: [dismissCoachActionToday(action.id, '2026-04-30T13:00:00.000Z')] }),
      '2026-05-01',
      { coachActions: [action] },
    );

    expect(plain.visibleCoachActions.map((item) => item.id)).toEqual([action.id]);
    expect(withReadyDraft.visibleCoachActions).toHaveLength(0);
    expect(withAppliedDraft.visibleCoachActions).toHaveLength(0);
    expect(withRolledBackDraft.visibleCoachActions.map((item) => item.id)).toEqual([action.id]);
    expect(dismissedToday.visibleCoachActions).toHaveLength(0);
    expect(dismissedTomorrow.visibleCoachActions.map((item) => item.id)).toEqual([action.id]);
  });

  it('keeps Plan inbox sourced from pipeline-visible actions only', () => {
    const action = makePlanAction();
    const data = makeAppData({ programAdjustmentDrafts: [makeDraft(action, 'applied')], programAdjustmentHistory: [makeHistoryItem(action, 'applied')] });
    const pipeline = buildEnginePipeline(data, '2026-04-30', { coachActions: [action] });
    const planViewModel = buildPlanViewModel(data, { coachActions: pipeline.visibleCoachActions });

    expect(pipeline.visibleCoachActions).toHaveLength(0);
    expect(planViewModel.coachInbox.visibleItems).toHaveLength(0);
    expect(planViewModel.adjustmentDrafts.drafts[0]?.statusLabel).toMatch(/[\u4e00-\u9fff]/);
  });

  it('creates sessions from the active experimental template and returns to source template after rollback', () => {
    const experiment = experimentalTemplate();
    const data = makeAppData({
      templates: [...makeAppData().templates.filter((template) => template.id !== experiment.id), experiment],
      activeProgramTemplateId: experiment.id,
      selectedTemplateId: experiment.id,
    });
    const experimentalSession = createSession(
      experiment,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    const source = getTemplate('pull-a');
    const sourceSession = createSession(
      source,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(experimentalSession.programTemplateId).toBe(experiment.id);
    expect(experimentalSession.isExperimentalTemplate).toBe(true);
    expect(experimentalSession.sourceProgramTemplateId).toBe('pull-a');
    expect(sourceSession.programTemplateId).toBe('pull-a');
    expect(sourceSession.isExperimentalTemplate).toBe(false);
  });

  it('documents mutation invalidation for pipeline-sensitive actions', () => {
    const events: AppMutationEvent[] = [
      'session_completed',
      'session_edited',
      'template_applied',
      'template_rolled_back',
      'coach_action_dismissed',
      'health_data_imported',
      'unit_changed',
      'backup_restored',
    ];
    const results = events.map((event) => buildDerivedStateInvalidation(event));

    expect(results.every((item) => item.reason.match(/[\u4e00-\u9fff]/))).toBe(true);
    expect(results.find((item, index) => events[index] === 'template_applied')?.invalidatePlan).toBe(true);
    expect(results.find((item, index) => events[index] === 'coach_action_dismissed')?.invalidateCoachActions).toBe(true);
    expect(results.find((item, index) => events[index] === 'unit_changed')?.invalidateAnalytics).toBe(false);
    expect(JSON.stringify(results)).not.toMatch(/\bundefined|null\b/);
  });
});
