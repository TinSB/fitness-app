import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { dismissCoachActionToday } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { completedSets, sessionCompletedSets, sessionVolume, setVolume } from '../src/engines/engineUtils';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  buildFocusStepQueue,
  completeFocusSet,
  endFocusRest,
  getCurrentFocusStep,
  setCurrentStep,
  switchFocusExercise,
} from '../src/engines/focusModeStateEngine';
import { upsertPlanAdjustmentDraftByFingerprint } from '../src/engines/planAdjustmentIdentityEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import {
  applySessionPatches,
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildIncompleteMainWorkGuard, completeTrainingSessionIntoHistory, finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { AppData, ProgramAdjustmentDraft, TrainingSession, TrainingTemplate } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const TEST_DATE = '2026-05-04';
const STARTED_AT = '2026-05-04T09:00:00-04:00';
const FINISHED_AT = '2026-05-04T10:15:00-04:00';

const temporaryPatch: SessionPatch = {
  id: 'full-product-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次先保留主训练。',
  reason: '当天状态一般，优先完成主训练。',
  reversible: true,
};

const makeCoachAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: 'coach-action-back-volume',
  title: '复核背部训练量',
  description: '本周背部有效组偏低，建议查看计划调整。',
  source: 'volumeAdaptation',
  actionType: 'create_plan_adjustment_preview',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: `${TEST_DATE}T12:00:00.000Z`,
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部有效组偏低。',
  sourceFingerprint: 'coach-action|volume|back|pull-a|add-sets',
  ...overrides,
});

const makeDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: 'draft-back-volume-applied',
  createdAt: `${TEST_DATE}T12:05:00.000Z`,
  status: 'applied',
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: 'coach-action-back-volume',
  sourceRecommendationId: 'recommendation-back-volume',
  sourceFingerprint: 'coach-action|volume|back|pull-a|add-sets',
  experimentalProgramTemplateId: 'pull-a-experimental',
  experimentalTemplateName: '拉 A 实验模板',
  appliedAt: `${TEST_DATE}T12:10:00.000Z`,
  title: '拉 A 调整草案',
  summary: '背部增加一组。',
  selectedRecommendationIds: ['recommendation-back-volume', 'coach-action-back-volume'],
  changes: [
    {
      id: 'change-back-add-set',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      dayTemplateName: '拉 A',
      exerciseId: 'lat-pulldown',
      exerciseName: '高位下拉',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部有效组偏低。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '先小幅增加背部训练量。',
  notes: [],
  ...overrides,
});

const expectVisibleTextClean = (text: string) => {
  expect(text).not.toMatch(/\b(undefined|null|push-a|pull-a|legs-a|pending|applied|dismissed|expired)\b/i);
  expect(text).not.toMatch(/__auto_alt|__alt_|currentFocusStepId|actualExerciseId|replacementExerciseId/);
};

const getTemplateFromData = (data: AppData, templateId: string) => {
  const template = data.templates.find((item) => item.id === templateId) || getTemplate(templateId);
  if (!template) throw new Error(`missing template ${templateId}`);
  return template;
};

const firstRunnableStep = (session: TrainingSession) =>
  buildFocusStepQueue(session).find((step) => step.blockType === 'main' && step.stepType !== 'completed');

const makeMainOnlyFocusSession = (session: TrainingSession): TrainingSession => {
  const next: TrainingSession = {
    ...session,
    correctionBlock: [],
    functionalBlock: [],
    supportExerciseLogs: [],
  };
  const firstStep = firstRunnableStep(next);
  if (firstStep) setCurrentStep(next, firstStep, { clearManualOverride: true });
  return next;
};

const addHeavyWarmupToFirstExercise = (session: TrainingSession): TrainingSession => {
  const next: TrainingSession = {
    ...session,
    exercises: session.exercises.map((exercise, index) =>
      index === 0
        ? {
            ...exercise,
            warmupSets: [{ weight: 999, reps: 1 }, ...((exercise.warmupSets || []).length ? exercise.warmupSets.slice(1) : [])],
          }
        : exercise,
    ),
    focusCompletedStepIds: [],
    focusWarmupSetLogs: [],
  };
  const firstStep = firstRunnableStep(next);
  if (firstStep) setCurrentStep(next, firstStep, { clearManualOverride: true });
  return next;
};

const startFromPipeline = (data: AppData, currentDate: string) => {
  const pipeline = buildEnginePipeline(data, currentDate);
  const template = getTemplateFromData(data, pipeline.nextWorkout.templateId);
  let activeSession = createSession(
    template,
    data.todayStatus,
    data.history,
    data.trainingMode,
    buildWeeklyPrescription(data),
    undefined,
    data.screeningProfile,
    data.mesocyclePlan,
  );
  activeSession = {
    ...activeSession,
    id: `session-${template.id}-${currentDate}`,
    date: currentDate,
    startedAt: STARTED_AT,
  };

  const pendingPatches = data.pendingSessionPatches || data.settings?.pendingSessionPatches || [];
  const activePendingPatch = findActivePendingSessionPatch(pendingPatches, currentDate, template.id);
  let nextPendingPatches = pendingPatches;
  if (activePendingPatch) {
    const patched = applySessionPatches(activeSession, activePendingPatch.patches);
    activeSession = patched.session;
    nextPendingPatches = markPendingSessionPatchConsumed(pendingPatches, activePendingPatch.id, STARTED_AT);
  }

  activeSession = makeMainOnlyFocusSession(activeSession);
  const nextData: AppData = {
    ...data,
    activeSession,
    pendingSessionPatches: nextPendingPatches,
    settings: {
      ...data.settings,
      pendingSessionPatches: nextPendingPatches,
    },
  };
  return { pipeline, template, activeSession, data: nextData, activePendingPatch };
};

const exerciseIndexByIdentity = (session: TrainingSession, exerciseId: string) => {
  const index = session.exercises.findIndex((exercise) =>
    [exercise.id, exercise.baseId, exercise.actualExerciseId, exercise.originalExerciseId, exercise.replacementExerciseId].includes(exerciseId),
  );
  if (index < 0) throw new Error(`missing exercise ${exerciseId}`);
  return index;
};

const completeCurrentStepAndRest = (session: TrainingSession, tick: number) => {
  const before = getCurrentFocusStep(session);
  let next = applySuggestedFocusStep(session, before.exerciseIndex);
  const step = getCurrentFocusStep(next);
  const completed = completeFocusSet(next, step.exerciseIndex, `${TEST_DATE}T09:${String(tick).padStart(2, '0')}:00-04:00`, tick * 1000, step.id);
  if (!completed) throw new Error(`expected completion for ${step.id}`);

  expect(completed.session.completed).toBe(false);
  expect(completed.session.restTimerState?.isRunning).toBe(true);
  const afterRest = endFocusRest(completed.session);
  expect(afterRest.session.restTimerState).toBeNull();
  expect(afterRest.session.completed).toBe(false);
  return afterRest.session;
};

const completeExercise = (session: TrainingSession, exerciseId: string, startTick: number) => {
  let next = switchFocusExercise(session, exerciseIndexByIdentity(session, exerciseId));
  let tick = startTick;
  let guard = 0;
  while (guard < 40) {
    const step = getCurrentFocusStep(next);
    if (step.stepType === 'completed' || step.exerciseIndex !== exerciseIndexByIdentity(next, exerciseId)) break;
    next = completeCurrentStepAndRest(next, tick);
    tick += 1;
    guard += 1;
  }
  return next;
};

const completeAllRemainingMainWork = (session: TrainingSession, startTick: number) => {
  let next = session;
  let tick = startTick;
  let guard = 0;
  while (guard < 200) {
    const step = getCurrentFocusStep(next);
    if (step.stepType === 'completed') return next;
    if (step.blockType !== 'main') throw new Error(`unexpected non-main step ${step.id}`);
    next = completeCurrentStepAndRest(next, tick);
    tick += 1;
    guard += 1;
  }
  throw new Error('focus completion loop exceeded guard');
};

const completedSetVolume = (session: TrainingSession, exerciseId: string) => {
  const exercise = session.exercises.find((item) => [item.id, item.actualExerciseId, item.originalExerciseId].includes(exerciseId));
  return (exercise ? completedSets(exercise) : []).reduce((sum, set) => sum + setVolume(set), 0);
};

const buildTodayVm = (data: AppData, currentDate: string) => {
  const pipeline = buildEnginePipeline(data, currentDate);
  const selectedTemplate = getTemplateFromData(data, data.selectedTemplateId);
  const completedSession =
    pipeline.todayState.status === 'completed'
      ? data.history.find((session) => session.id === pipeline.todayState.lastCompletedSessionId)
      : undefined;
  return {
    pipeline,
    viewModel: buildTodayViewModel({
      todayState: pipeline.todayState,
      selectedTemplate,
      completedTemplateName: completedSession?.templateName,
      activeTemplateName: data.activeSession?.templateName,
      nextSuggestion: getTemplateFromData(data, pipeline.nextWorkout.templateId),
      nextWorkout: pipeline.nextWorkout,
    }),
  };
};

describe('full product real session regression', () => {
  it('covers Today -> Focus -> Record -> Today for a normally completed Pull A session', () => {
    const previousPush = makeSession({
      id: 'previous-push',
      date: '2026-05-03',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
    });
    const pendingPatch = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: STARTED_AT,
      sourceFingerprint: 'daily-adjustment:pull-a:main-only',
      targetTemplateId: 'pull-a',
    });
    const initialData = makeAppData({
      selectedTemplateId: 'legs-a',
      history: [previousPush],
      pendingSessionPatches: [pendingPatch],
      settings: { pendingSessionPatches: [pendingPatch] },
    });

    const initialToday = buildTodayVm(initialData, TEST_DATE);
    expect(initialToday.pipeline.todayState).toMatchObject({ status: 'not_started', primaryAction: 'start_training' });
    expect(initialToday.pipeline.nextWorkout.templateId).toBe('pull-a');
    expect(initialToday.viewModel.recommendedTemplateId).toBe('pull-a');
    expect(initialToday.viewModel.primaryActionLabel).not.toContain('查看本次训练');
    expectVisibleTextClean(
      [
        initialToday.viewModel.pageTitle,
        initialToday.viewModel.statusText,
        initialToday.viewModel.decisionText,
        initialToday.viewModel.nextSuggestion.description,
        initialToday.viewModel.nextSuggestion.reason || '',
      ].join(' '),
    );

    const started = startFromPipeline(initialData, TEST_DATE);
    expect(started.template.id).toBe('pull-a');
    expect(started.activeSession).toMatchObject({
      templateId: 'pull-a',
      programTemplateId: 'pull-a',
      completed: false,
    });
    expect(started.activePendingPatch?.id).toBe(pendingPatch.id);
    expect(started.data.pendingSessionPatches).toEqual([expect.objectContaining({ id: pendingPatch.id, status: 'consumed' })]);
    expect(findActivePendingSessionPatch(started.data.pendingSessionPatches, TEST_DATE, 'pull-a')).toBeUndefined();
    expect(started.activeSession.appliedCoachActions).toEqual([expect.objectContaining({ id: temporaryPatch.id })]);
    expect(buildEnginePipeline(started.data, TEST_DATE).todayState).toMatchObject({ status: 'in_progress', primaryAction: 'continue_training' });

    let session = addHeavyWarmupToFirstExercise(started.activeSession);
    session = completeExercise(session, 'lat-pulldown', 1);
    session = completeExercise(session, 'seated-row', 20);

    const barbellRowIndex = exerciseIndexByIdentity(session, 'barbell-row');
    session = switchFocusExercise(session, barbellRowIndex);
    session = applyExerciseReplacement(session, barbellRowIndex, 'chest-supported-row');
    expect(session.exercises[barbellRowIndex]).toMatchObject({
      originalExerciseId: 'barbell-row',
      actualExerciseId: 'chest-supported-row',
      replacementExerciseId: 'chest-supported-row',
    });
    expect(getCurrentFocusStep(session)).toMatchObject({ exerciseId: 'chest-supported-row', exerciseIndex: barbellRowIndex });
    session = completeExercise(session, 'chest-supported-row', 40);
    session = completeAllRemainingMainWork(session, 80);

    const guard = buildIncompleteMainWorkGuard(session);
    expect(guard).toMatchObject({ hasIncompleteMainWork: false, incompleteSetCount: 0 });

    const completedResult = completeTrainingSessionIntoHistory(
      {
        ...started.data,
        activeSession: session,
      },
      FINISHED_AT,
    );
    expect(completedResult.session).not.toBeNull();
    const completedSession = completedResult.session!;
    expect(completedResult.data.activeSession).toBeNull();
    expect(completedResult.data.history[0]).toMatchObject({
      id: completedSession.id,
      templateId: 'pull-a',
      dataFlag: 'normal',
      completed: true,
    });

    const summary = buildSessionDetailSummary(completedSession);
    expect(summary.completedWorkingSetCount).toBe(sessionCompletedSets(completedSession));
    expect(summary.workingVolumeKg).toBe(sessionVolume(completedSession));
    expect(summary.incompleteSetCount).toBe(0);
    expect(summary.warmupSetCount).toBeGreaterThan(0);
    expect(summary.warmupVolumeKg).toBeGreaterThan(900);
    expect(summary.effectiveSummary.completedSets).toBe(summary.completedWorkingSetCount);
    expect(summary.groupedSets.workingSets.every((entry) => entry.set.type !== 'warmup')).toBe(true);
    const replacedExercise = completedSession.exercises.find((exercise) => exercise.actualExerciseId === 'chest-supported-row');
    expect(replacedExercise).toBeDefined();
    expect(replacedExercise).toMatchObject({
      originalExerciseId: 'barbell-row',
      actualExerciseId: 'chest-supported-row',
      replacementExerciseId: 'chest-supported-row',
    });
    expect(getExerciseRecordPoolId(replacedExercise!)).toBe('chest-supported-row');
    const prs = buildPrs([completedSession]);
    expect(prs.map((item) => item.exerciseId)).toContain('chest-supported-row');
    expect(prs.map((item) => item.exerciseId)).not.toContain('barbell-row');
    expect(buildE1RMProfile([completedSession], 'lat-pulldown').best?.weight).not.toBe(999);
    expect(buildE1RMProfile([completedSession], 'chest-supported-row').best?.exerciseId).toBe('chest-supported-row');

    const completedToday = buildTodayVm(completedResult.data, TEST_DATE);
    expect(completedToday.pipeline.todayState).toMatchObject({ status: 'completed', primaryAction: 'view_summary' });
    expect(completedToday.viewModel.primaryActionLabel).toBe('查看本次训练');
    expect(initialToday.pipeline.nextWorkout.templateId).toBe('pull-a');
    expect(initialToday.pipeline.nextWorkout.templateId).not.toBe(initialData.selectedTemplateId);
    expect(completedToday.pipeline.nextWorkout.templateId).toBe('legs-a');
    expect(completedToday.viewModel.recommendedTemplateId || completedToday.viewModel.nextSuggestion.templateId).toBe(
      completedToday.pipeline.nextWorkout.templateId,
    );
    expectVisibleTextClean(
      [
        completedToday.viewModel.pageTitle,
        completedToday.viewModel.statusText,
        completedToday.viewModel.decisionText,
        completedToday.viewModel.nextSuggestion.description,
        completedToday.viewModel.nextSuggestion.reason || '',
      ].join(' '),
    );

    const action = makeCoachAction();
    const appliedDraft = makeDraft({ sourceCoachActionId: action.id, sourceFingerprint: action.sourceFingerprint });
    const dismissed = dismissCoachActionToday('coach-action-dismissed', `${TEST_DATE}T12:00:00.000Z`);
    const dismissedAction = makeCoachAction({
      id: 'coach-action-dismissed',
      sourceFingerprint: 'coach-action|volume|legs|legs-a|watch',
      title: '观察腿部训练量',
      description: '本周腿部训练量先观察。',
      reason: '腿部完成度正常。',
    });
    const pipelineAfterCoachFilters = buildEnginePipeline(
      {
        ...completedResult.data,
        dismissedCoachActions: [dismissed],
        settings: { ...completedResult.data.settings, dismissedCoachActions: [dismissed] },
        programAdjustmentDrafts: [appliedDraft],
      },
      TEST_DATE,
      { coachActions: [action, dismissedAction] },
    );
    expect(pipelineAfterCoachFilters.coachActions.map((item) => item.id)).toEqual([action.id, dismissedAction.id]);
    expect(pipelineAfterCoachFilters.visibleCoachActions).toHaveLength(0);
  });

  it('covers early Push A finish with confirm guard, incomplete set exclusion, and stable focus cursor', () => {
    const data = makeAppData({ selectedTemplateId: 'legs-a' });
    const pipeline = buildEnginePipeline(data, TEST_DATE);
    expect(pipeline.todayState).toMatchObject({ status: 'not_started', primaryAction: 'start_training' });
    expect(pipeline.nextWorkout.templateId).toBe('push-a');

    let session = createSession(
      getTemplate('push-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    session = makeMainOnlyFocusSession({
      ...session,
      id: 'early-push-session',
      date: TEST_DATE,
      startedAt: STARTED_AT,
    });
    session = completeExercise(session, 'bench-press', 1);

    const inclineIndex = exerciseIndexByIdentity(session, 'incline-db-press');
    session = switchFocusExercise(session, inclineIndex);
    expect(getCurrentFocusStep(session)).toMatchObject({ exerciseId: 'incline-db-press', exerciseIndex: inclineIndex });
    session = adjustFocusSetValue(session, inclineIndex, 'weight', 2.5);
    expect(getCurrentFocusStep(session)).toMatchObject({ exerciseId: 'incline-db-press', exerciseIndex: inclineIndex });
    session = adjustFocusSetValue(session, inclineIndex, 'reps', 1);
    expect(getCurrentFocusStep(session)).toMatchObject({ exerciseId: 'incline-db-press', exerciseIndex: inclineIndex });
    session = applySuggestedFocusStep(session, inclineIndex);
    expect(getCurrentFocusStep(session)).toMatchObject({ exerciseId: 'incline-db-press', exerciseIndex: inclineIndex });

    const guard = buildIncompleteMainWorkGuard(session);
    expect(guard.hasIncompleteMainWork).toBe(true);
    expect(guard.incompleteSetCount).toBeGreaterThan(0);
    expect(guard.incompleteExercises.map((item) => item.exerciseId)).toContain('incline-db-press');

    const finished = finalizeTrainingSession(session, FINISHED_AT, { endedEarly: true });
    const summary = buildSessionDetailSummary(finished);
    const benchCompletedSetCount = completedSets(finished.exercises.find((exercise) => exercise.id === 'bench-press')).length;
    const expectedBenchVolume = completedSetVolume(finished, 'bench-press');
    const incline = finished.exercises.find((exercise) => exercise.id === 'incline-db-press');

    expect(finished).toMatchObject({
      completed: true,
      earlyEndReason: 'incomplete_main_work',
    });
    expect(finished.earlyEndSummary).toEqual(expect.stringContaining('未完成'));
    expect(incline).toMatchObject({ completionStatus: 'not_started', incompleteReason: 'ended_early' });
    expect((incline?.sets || []).every((set) => set.done === false && !set.completedAt)).toBe(true);
    expect(summary.incompleteSetCount).toBeGreaterThan(0);
    expect(summary.earlyEndSummary).toContain('未完成');
    expect(summary.completedWorkingSetCount).toBe(benchCompletedSetCount);
    expect(summary.workingVolumeKg).toBe(expectedBenchVolume);
    expect(sessionVolume(finished)).toBe(expectedBenchVolume);
    const effective = buildEffectiveVolumeSummary([finished]);
    expect(effective.completedSets).toBe(benchCompletedSetCount);
    expect(effective.effectiveSets).toBe(benchCompletedSetCount);
    expect(buildPrs([finished]).map((item) => item.exerciseId)).not.toContain('incline-db-press');
    expect(buildE1RMProfile([finished], 'incline-db-press').best).toBeUndefined();
    expectVisibleTextClean([guard.summary, summary.earlyEndSummary, summary.dataFlagLabel].join(' '));
  });

  it('keeps same-source applied drafts out of visible CoachAction lists while preserving draft upsert state', () => {
    const action = makeCoachAction();
    const activeDraft = makeDraft({ id: 'draft-random-a', status: 'ready_to_apply', sourceFingerprint: action.sourceFingerprint });
    const duplicate = makeDraft({ id: 'draft-random-b', status: 'ready_to_apply', sourceFingerprint: action.sourceFingerprint });
    const upserted = upsertPlanAdjustmentDraftByFingerprint([activeDraft], [], duplicate, action.sourceFingerprint || '');
    const appliedDraft = makeDraft({ status: 'applied', sourceFingerprint: action.sourceFingerprint, sourceCoachActionId: action.id });
    const data = makeAppData({
      programAdjustmentDrafts: [appliedDraft],
    });
    const pipeline = buildEnginePipeline(data, TEST_DATE, { coachActions: [action] });

    expect(upserted).toMatchObject({ outcome: 'opened_existing' });
    expect(upserted.drafts).toHaveLength(1);
    expect(upserted.drafts[0].id).toBe(activeDraft.id);
    expect(pipeline.coachActions).toHaveLength(1);
    expect(pipeline.visibleCoachActions).toHaveLength(0);
  });
});
