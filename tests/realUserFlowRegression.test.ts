import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildDataHealthReport, dismissDataHealthIssueToday, filterDismissedDataHealthIssues, type DataHealthReport } from '../src/engines/dataHealthEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { completedSets, sessionCompletedSets, sessionVolume, todayKey } from '../src/engines/engineUtils';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  completeFocusSet,
  endFocusRest,
  getCurrentFocusStep,
  switchFocusExercise,
} from '../src/engines/focusModeStateEngine';
import { buildPlanAdjustmentDraftInstanceId, upsertPlanAdjustmentDraftByFingerprint } from '../src/engines/planAdjustmentIdentityEngine';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations, rollbackAdjustment } from '../src/engines/programAdjustmentEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import {
  applySessionPatches,
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  upsertPendingSessionPatch,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildIncompleteMainWorkGuard, completeTrainingSessionIntoHistory, finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import type { ProgramAdjustmentDraft, TrainingSession, WeeklyActionRecommendation } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { getTemplate, makeAppData, makeSession } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makePushFocusSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
    { ...makeExercise('shoulder-press', 1), name: '肩推' },
  ]);

const adjustmentRecommendation: WeeklyActionRecommendation = {
  id: 'coach-action-volume-preview-back-increase',
  priority: 'medium',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: '背部',
  issue: '背部训练量不足',
  recommendation: '下周给背部小幅增加 1 组。',
  reason: '背部近期有效组不足，且完成率良好。',
  suggestedChange: {
    muscleId: 'back',
    setsDelta: 1,
    exerciseIds: ['lat-pulldown'],
  },
  confidence: 'medium',
};

const temporaryPatch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练。',
  reason: '今天状态一般，优先完成主训练。',
  reversible: true,
};

const makeDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: overrides.id || 'draft-candidate',
  createdAt: overrides.createdAt || '2026-05-01T10:00:00.000Z',
  status: overrides.status || 'ready_to_apply',
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: 'coach-action-back-volume',
  sourceRecommendationId: 'recommendation-back-volume',
  sourceFingerprint: overrides.sourceFingerprint || 'coach-action|volume|back|pull-a|add-sets',
  experimentalTemplateName: '拉 A 实验模板',
  title: '拉 A 下周实验调整',
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
  explanation: '背部有效组偏低，先小幅增加。',
  notes: [],
  ...overrides,
});

const makeSessionWithWarmup = (): TrainingSession => ({
  ...makeSession({
    id: 'record-edit-session',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
  }),
  focusWarmupSetLogs: [
    {
      id: 'main:bench-press:warmup:0',
      type: 'warmup',
      weight: 20,
      actualWeightKg: 20,
      reps: 8,
      rir: '',
      done: true,
    },
  ],
});

const applyPlanAdjustmentToData = () => {
  const data = makeAppData({ activeProgramTemplateId: 'pull-a', selectedTemplateId: 'pull-a' });
  const sourceTemplate = getTemplate('pull-a');
  const draft = createAdjustmentDraftFromRecommendations([adjustmentRecommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
  if (!applied.experimentalTemplate || !applied.historyItem) throw new Error('expected experimental template');
  return {
    data: {
      ...data,
      templates: [applied.experimentalTemplate, ...data.templates],
      activeProgramTemplateId: applied.experimentalTemplate.id,
      programAdjustmentDrafts: [applied.draft],
      programAdjustmentHistory: [applied.historyItem],
    },
    sourceTemplate,
    experimentalTemplate: applied.experimentalTemplate,
    applied,
  };
};

const dataHealthReport: DataHealthReport = {
  status: 'has_warnings',
  summary: '发现需要复核的数据问题。',
  issues: [
    {
      id: 'summary-volume-zero-session-1',
      severity: 'warning',
      category: 'summary',
      title: '训练汇总可能过期',
      message: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
      affectedIds: ['session-1'],
      canAutoFix: false,
    },
  ],
};

const expectCleanUserText = (text: string) => {
  expect(text).not.toMatch(/\b(undefined|null|high|medium|low|warmup|working|support|compound|isolation|machine)\b/i);
  expect(text).not.toMatch(/__auto_alt|__alt_|summary-volume-zero-session-1/);
};

describe('real user flow regression gate', () => {
  it('Today -> start training -> Focus Mode creates an active session from the active template', () => {
    const data = makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' });
    const activeTemplate = data.templates.find((template) => template.id === data.activeProgramTemplateId);
    if (!activeTemplate) throw new Error('missing active template');

    const activeSession = createSession(
      activeTemplate,
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(activeSession).toMatchObject({ templateId: 'pull-a', programTemplateId: 'pull-a', completed: false });
    expect(getCurrentFocusStep(activeSession).stepType).not.toBe('completed');
  });

  it('Focus Mode -> switch exercise -> adjust weight -> apply suggestion -> complete set keeps the target cursor', () => {
    let session = switchFocusExercise(makePushFocusSession(), 1);
    session = adjustFocusSetValue(session, 1, 'weight', 2.5);
    expect(getCurrentFocusStep(session).exerciseId).toBe('incline-db-press');

    session = applySuggestedFocusStep(session, 1);
    const current = getCurrentFocusStep(session);
    const result = completeFocusSet(session, 1, '2026-05-01T10:00:00.000Z', 1000, current.id);
    if (!result) throw new Error('expected completed focus set');

    expect(result.completedExerciseIndex).toBe(1);
    expect(result.session.exercises[1].sets[0]).toMatchObject({ done: true, completedAt: '2026-05-01T10:00:00.000Z' });
    expect(result.session.exercises[0].sets[0].done).toBe(false);
    expect(getCurrentFocusStep(result.session)).toMatchObject({ exerciseId: 'incline-db-press', setIndex: 1 });
  });

  it('Focus Mode -> replacement -> complete set preserves original and actual exercise identities in history', () => {
    let session = makeFocusSession([{ ...makeExercise('bench-press', 1), name: '平板卧推' }]);
    session = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_REPLACEMENT', exerciseIndex: 0, replacementId: 'db-bench-press' }).updatedSession;
    session = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    session = dispatchWorkoutExecutionEvent(session, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-01T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: getCurrentFocusStep(session).id,
    }).updatedSession;
    const completed = completeTrainingSessionIntoHistory({ ...makeAppData(), activeSession: session }, '2026-05-01T10:05:00.000Z');
    const historySession = completed.data.history[0];

    expect(historySession.exercises[0]).toMatchObject({
      originalExerciseId: 'bench-press',
      actualExerciseId: 'db-bench-press',
      replacementExerciseId: 'db-bench-press',
    });
    expect(buildPrs(completed.data.history).some((item) => item.exerciseId === 'db-bench-press')).toBe(true);
    expect(buildPrs(completed.data.history).some((item) => item.exerciseId === 'bench-press')).toBe(false);
    expect(buildE1RMProfile(completed.data.history, 'db-bench-press').best).toBeDefined();
    expect(buildE1RMProfile(completed.data.history, 'bench-press').best).toBeUndefined();
  });

  it('Focus Mode -> rest timer -> end rest enters the next set without finalizing the session', () => {
    let session = makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);
    session = applySuggestedFocusStep(session, 0);
    const completed = completeFocusSet(session, 0, '2026-05-01T10:00:00.000Z', 1000, getCurrentFocusStep(session).id);
    if (!completed) throw new Error('expected first set completion');

    const restEnded = endFocusRest(completed.session);

    expect(completed.session.restTimerState?.isRunning).toBe(true);
    expect(restEnded.session.restTimerState).toBeNull();
    expect(restEnded.session.completed).toBe(false);
    expect(restEnded.nextStep).toMatchObject({ exerciseId: 'bench-press', setIndex: 1 });
  });

  it('Focus Mode -> early finish detects unfinished main work and keeps draft sets out of effective sets', () => {
    const session = makeFocusSession([
      makeExercise('assisted-pull-up', 2, 2),
      makeExercise('face-pull', 2, 0),
    ]);
    const guard = buildIncompleteMainWorkGuard(session);
    const finished = finalizeTrainingSession(session, '2026-05-01T11:00:00.000Z', { endedEarly: true });
    const facePull = finished.exercises.find((exercise) => exercise.id === 'face-pull');
    const effective = buildEffectiveVolumeSummary([finished]);

    expect(guard.hasIncompleteMainWork).toBe(true);
    expect(facePull).toMatchObject({ completionStatus: 'not_started', incompleteReason: 'ended_early' });
    expect(completedSets(facePull || { sets: [] })).toHaveLength(0);
    expect(effective.completedSets).toBe(2);
    expect(effective.effectiveSets).toBe(2);
  });

  it('Record -> history detail keeps Summary consistent with completed set logs', () => {
    const session = makeSession({
      id: 'record-summary-session',
      date: '2026-04-30',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 80, reps: 6, rir: 2 },
        { weight: 75, reps: 8, rir: 2 },
      ],
    });
    const summary = buildSessionDetailSummary(session);

    expect(summary.completedWorkingSetCount).toBe(sessionCompletedSets(session));
    expect(summary.workingVolumeKg).toBe(sessionVolume(session));
    expect(summary.groupedSets.workingSets.map((item) => item.set.id)).toEqual(['bench-press-1', 'bench-press-2']);
  });

  it('Record -> edit working set updates Summary volume and writes edit history', () => {
    const session = makeSessionWithWarmup();
    const before = buildSessionDetailSummary(session);
    const edited = markSessionEdited(
      updateSessionSet(session, 'bench-press', 'bench-press-1', { weightKg: 100, reps: 8, rir: 1 }),
      ['sets'],
      'real user flow correction',
    );
    const after = buildSessionDetailSummary(edited);

    expect(after.workingVolumeKg).toBeGreaterThan(before.workingVolumeKg);
    expect(edited.editHistory?.at(-1)).toMatchObject({ fields: ['sets'], note: 'real user flow correction' });
  });

  it('Record -> edit warmup set does not affect PR, e1RM, or effective set outputs', () => {
    const session = makeSessionWithWarmup();
    const beforePrs = buildPrs([session]);
    const beforeE1rm = buildE1RMProfile([session], 'bench-press').best?.e1rmKg;
    const beforeEffective = buildEffectiveVolumeSummary([session]);
    const edited = markSessionEdited(
      updateSessionSet(session, 'bench-press', 'main:bench-press:warmup:0', { weightKg: 200, reps: 20 }),
      ['warmupSets'],
      'warmup correction',
    );
    const afterEffective = buildEffectiveVolumeSummary([edited]);

    expect(buildPrs([edited])).toEqual(beforePrs);
    expect(buildE1RMProfile([edited], 'bench-press').best?.e1rmKg).toBe(beforeE1rm);
    expect(afterEffective.effectiveSets).toBe(beforeEffective.effectiveSets);
    expect(buildSessionDetailSummary(edited).workingVolumeKg).toBe(buildSessionDetailSummary(session).workingVolumeKg);
  });

  it('Today -> adopt temporary adjustment persists pending patch across sanitize refresh', () => {
    const data = makeAppData({ pendingSessionPatches: [], settings: { pendingSessionPatches: [] } });
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const upserted = upsertPendingSessionPatch(data.pendingSessionPatches, pending);
    const refreshed = sanitizeData({
      ...data,
      pendingSessionPatches: upserted.pendingPatches,
      settings: { ...data.settings, pendingSessionPatches: upserted.pendingPatches },
    });

    expect(upserted.created).toBe(true);
    expect(refreshed.pendingSessionPatches).toEqual([
      expect.objectContaining({ id: pending.id, status: 'pending', sourceFingerprint: 'daily-adjustment:pull-a' }),
    ]);
    expect(refreshed.settings.pendingSessionPatches).toEqual(refreshed.pendingSessionPatches);
  });

  it('Today -> start training consumes the pending patch and the next session does not inherit it', () => {
    const data = makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' });
    const session = createSession(
      getTemplate('pull-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    const pending = buildPendingSessionPatch({
      patches: [temporaryPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const activePending = findActivePendingSessionPatch([pending], '2026-05-01', 'pull-a');
    const patched = applySessionPatches(session, activePending?.patches || []);
    const consumed = markPendingSessionPatchConsumed([pending], pending.id, '2026-05-01T08:00:00.000Z');
    const nextSession = createSession(
      getTemplate('pull-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(patched.session.appliedCoachActions).toEqual([expect.objectContaining({ id: temporaryPatch.id })]);
    expect(consumed).toEqual([expect.objectContaining({ id: pending.id, status: 'consumed' })]);
    expect(findActivePendingSessionPatch(consumed, '2026-05-01', 'pull-a')).toBeUndefined();
    expect(nextSession.appliedCoachActions || []).toHaveLength(0);
  });

  it('Plan -> generate adjustment draft uses source fingerprint upsert and does not duplicate active drafts', () => {
    const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';
    const first = upsertPlanAdjustmentDraftByFingerprint([], [], makeDraft({ id: 'random-a' }), sourceFingerprint);
    const second = upsertPlanAdjustmentDraftByFingerprint(first.drafts, [], makeDraft({ id: 'random-b' }), sourceFingerprint);

    expect(first).toMatchObject({ outcome: 'created' });
    expect(first.createdDraft).toMatchObject({
      id: buildPlanAdjustmentDraftInstanceId(sourceFingerprint, 1),
      sourceFingerprint,
      status: 'ready_to_apply',
    });
    expect(second).toMatchObject({ outcome: 'opened_existing' });
    expect(second.drafts).toHaveLength(1);
    expect(second.drafts[0].id).toBe(first.createdDraft?.id);
  });

  it('Plan -> apply experimental template updates draft state and activeProgramTemplateId', () => {
    const { data, experimentalTemplate, applied } = applyPlanAdjustmentToData();

    expect(applied.draft).toMatchObject({
      status: 'applied',
      experimentalProgramTemplateId: experimentalTemplate.id,
    });
    expect(applied.draft.appliedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(data.activeProgramTemplateId).toBe(experimentalTemplate.id);
    expect(data.templates.find((template) => template.id === data.activeProgramTemplateId)?.isExperimentalTemplate).toBe(true);
  });

  it('Today / Training -> start session uses the active experimental template', () => {
    const { data, experimentalTemplate, sourceTemplate } = applyPlanAdjustmentToData();
    const activeTemplate = data.templates.find((template) => template.id === data.activeProgramTemplateId);
    if (!activeTemplate) throw new Error('missing active experimental template');
    const session = createSession(activeTemplate, data.todayStatus, data.history, data.trainingMode, null, null, data.screeningProfile, data.mesocyclePlan);

    expect(session).toMatchObject({
      programTemplateId: experimentalTemplate.id,
      isExperimentalTemplate: true,
      sourceProgramTemplateId: sourceTemplate.id,
    });
  });

  it('Plan -> rollback experimental template restores activeProgramTemplateId to the source template', () => {
    const { data, sourceTemplate, applied } = applyPlanAdjustmentToData();
    if (!applied.historyItem) throw new Error('missing history item');
    const rollback = rollbackAdjustment(applied.historyItem);
    const rolledBackData = {
      ...data,
      activeProgramTemplateId: rollback.restoredTemplateId,
      programAdjustmentHistory: [rollback.updatedHistoryItem],
      programAdjustmentDrafts: data.programAdjustmentDrafts?.map((draft) => ({ ...draft, status: 'rolled_back' as const, rolledBackAt: rollback.updatedHistoryItem.rolledBackAt })),
    };

    expect(rolledBackData.activeProgramTemplateId).toBe(sourceTemplate.id);
    expect(rolledBackData.programAdjustmentHistory[0]).toMatchObject({ status: 'rolled_back', rollbackAvailable: false });
    expect(rolledBackData.programAdjustmentDrafts?.[0]).toMatchObject({ status: 'rolled_back' });
    expect(rolledBackData.templates.some((template) => template.isExperimentalTemplate)).toBe(true);
  });

  it('DataHealth -> dismiss hides an issue for today, keeps the original report, and restores tomorrow', () => {
    const dismissed = dismissDataHealthIssueToday('summary-volume-zero-session-1', todayKey());
    const data = makeAppData({
      dismissedDataHealthIssues: [dismissed],
      settings: { dismissedDataHealthIssues: [dismissed] },
    });
    const todayVisible = filterDismissedDataHealthIssues(dataHealthReport.issues, data.dismissedDataHealthIssues, todayKey());
    const tomorrowVisible = filterDismissedDataHealthIssues(dataHealthReport.issues, data.dismissedDataHealthIssues, '2099-01-01');
    const todayVm = buildDataHealthViewModel(dataHealthReport, { dismissedIssues: data.dismissedDataHealthIssues, currentDate: todayKey() });

    expect(data.dismissedDataHealthIssues).toEqual([expect.objectContaining({ issueId: 'summary-volume-zero-session-1', scope: 'today' })]);
    expect(data.settings.dismissedDataHealthIssues).toEqual(data.dismissedDataHealthIssues);
    expect(todayVisible).toHaveLength(0);
    expect(tomorrowVisible).toEqual(dataHealthReport.issues);
    expect(dataHealthReport.issues).toHaveLength(1);
    expect(todayVm.primaryIssues).toHaveLength(0);
  });

  it('keeps user-visible regression text free of raw enum, null, undefined, and internal ids', () => {
    const sanitizedIdentityData = sanitizeData(makeAppData({
      history: [
        {
          ...makeSession({
            id: 'identity-health-session',
            date: '2026-04-30',
            templateId: 'push-a',
            exerciseId: 'bench-press',
            setSpecs: [{ weight: 80, reps: 6 }],
          }),
          exercises: [
            {
              ...makeSession({
                id: 'identity-health-session',
                date: '2026-04-30',
                templateId: 'push-a',
                exerciseId: 'bench-press',
                setSpecs: [{ weight: 80, reps: 6 }],
              }).exercises[0],
              actualExerciseId: '__auto_alt',
            },
          ],
        },
      ],
    }));
    const report = buildDataHealthReport(sanitizedIdentityData);
    const vm = buildDataHealthViewModel(report, { currentDate: todayKey() });
    const visibleText = [
      vm.summary,
      ...vm.primaryIssues.flatMap((issue) => [issue.title, issue.userMessage, issue.severityLabel, issue.action?.label || '', issue.dismissAction?.label || '']),
    ].join(' ');

    expect(vm.primaryIssues.length).toBeGreaterThan(0);
    expectCleanUserText(visibleText);
  });
});
