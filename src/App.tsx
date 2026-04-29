import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, Dumbbell, Flame, UserCircle } from 'lucide-react';
import { INITIAL_TEMPLATES } from './data/trainingData';
import { TodayView } from './features/TodayView';
import { TrainingFocusView } from './features/TrainingFocusView';
import type { ProfileTargetSection } from './features/ProfileView';
import { buildWeeklyPrescription } from './engines/supportPlanEngine';
import { clone, enrichExercise, findTemplate, hydrateTemplates, number, todayKey } from './engines/engineUtils';
import { createSession, pickSuggestedTemplate } from './engines/sessionBuilder';
import {
  extendRestTimer,
  pauseRestTimer,
  resumeRestTimer,
} from './engines/restTimerEngine';
import { reconcileScreeningProfile } from './engines/adaptiveFeedbackEngine';
import { normalizeTemplateExerciseInput } from './engines/exercisePrescriptionEngine';
import {
  getCurrentFocusStep,
  switchFocusExercise,
  updateFocusActualDraft,
} from './engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from './engines/workoutExecutionStateMachine';
import { upsertLoadFeedback } from './engines/loadFeedbackEngine';
import { deleteTrainingSession, filterAnalyticsHistory, markSessionDataFlag } from './engines/sessionHistoryEngine';
import { buildMuscleVolumeDashboard } from './engines/analytics';
import { buildEffectiveVolumeSummary } from './engines/effectiveSetEngine';
import { buildTrainingIntelligenceSummary } from './engines/trainingIntelligenceSummaryEngine';
import { completeTrainingSessionIntoHistory } from './engines/trainingCompletionEngine';
import { sanitizeUnitSettings } from './engines/unitConversionEngine';
import { buildReplacementOptions } from './engines/replacementEngine';
import { applyStatusRules } from './engines/progressionEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from './engines/trainingDecisionContext';
import { buildCoachAutomationSummary } from './engines/coachAutomationEngine';
import { buildCoachActions, type CoachAction } from './engines/coachActionEngine';
import { buildPainPatterns } from './engines/painPatternEngine';
import { buildRecoveryAwareRecommendation } from './engines/recoveryAwareScheduler';
import {
  applySessionPatches,
  buildSessionPatchesFromDailyAdjustment,
  revertSessionPatches,
  type SessionPatch,
} from './engines/sessionPatchEngine';
import { formatTemplateName } from './i18n/formatters';
import type { AppData, LoadFeedbackValue, ProgramAdjustmentDraft, RestTimerState, SessionDataFlag, SupportSkipReason, TrainingMode, TrainingSession, TrainingSetLog, TodayStatus, UnitSettings } from './models/training-model';
import type { DataHealthActionView } from './presenters/dataHealthPresenter';
import { loadData, saveData } from './storage/persistence';
import { AddToHomeScreenHint } from './ui/AddToHomeScreenHint';
import { AppShell } from './ui/AppShell';
import { ActionButton } from './ui/ActionButton';
import { Card } from './ui/Card';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { Toast } from './ui/Toast';
import { useConfirmDialog } from './ui/useConfirmDialog';
import { ResponsivePageLayout } from './ui/layouts/ResponsivePageLayout';

const AssessmentView = lazy(() => import('./features/AssessmentView').then((module) => ({ default: module.AssessmentView })));
const PlanView = lazy(() => import('./features/PlanView').then((module) => ({ default: module.PlanView })));
const ProfileView = lazy(() => import('./features/ProfileView').then((module) => ({ default: module.ProfileView })));
const RecordView = lazy(() => import('./features/RecordView').then((module) => ({ default: module.RecordView })));
const TrainingView = lazy(() => import('./features/TrainingView').then((module) => ({ default: module.TrainingView })));

const navItems = [
  { id: 'today', label: '今日', icon: Flame },
  { id: 'training', label: '训练', icon: Dumbbell },
  { id: 'record', label: '记录', icon: CalendarDays },
  { id: 'plan', label: '计划', icon: BookOpen },
  { id: 'profile', label: '我的', icon: UserCircle },
] as const;

type ActiveTab = (typeof navItems)[number]['id'];
type ProgressSectionTarget = 'calendar' | 'list' | 'pr' | 'stats' | 'data';
type ProfileSection = 'home' | 'assessment';
type AppToast = { message: string; tone: 'success' | 'warning' | 'danger' | 'info' };
type StatusField = 'sleep' | 'energy' | 'time';
type SorenessPart = TodayStatus['soreness'][number];
type EditableSetField = 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality';

const getSetList = (session: TrainingSession | null, exerciseIndex: number): TrainingSetLog[] => {
  if (!session) return [];
  const exercise = session.exercises?.[exerciseIndex];
  if (!exercise || !Array.isArray(exercise.sets)) return [];
  return exercise.sets as TrainingSetLog[];
};

const LazyPageFallback = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
    <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600">正在加载训练数据...</div>
  </div>
);

const AppAuxiliaryPanel = ({
  activeTab,
  activeSession,
  selectedTemplateName,
  suggestedTemplateName,
  profileSection,
  todayStatus,
}: {
  activeTab: ActiveTab;
  activeSession: TrainingSession | null | undefined;
  selectedTemplateName: string;
  suggestedTemplateName: string;
  profileSection: ProfileSection;
  todayStatus: TodayStatus;
}) => {
  const title =
    activeTab === 'today'
      ? '今日辅助'
      : activeTab === 'training'
        ? '训练辅助'
        : activeTab === 'record'
          ? '记录辅助'
          : activeTab === 'plan'
            ? '计划辅助'
            : '我的辅助';

  return (
    <Card className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">
          {activeTab === 'today'
            ? '用于放置低优先级状态，不挤占主决策区。'
            : activeTab === 'training'
              ? '训练页优先保留记录操作，辅助信息保持轻量。'
              : activeTab === 'record'
                ? '记录页默认日历，统计和 PR 留在二级分区。'
                : activeTab === 'plan'
                  ? '计划页只处理未来安排和模板状态。'
                  : '设置、筛查、单位和数据入口集中在这里。'}
        </div>
      </div>

      {activeTab === 'today' ? (
        <div className="space-y-2 text-sm">
          <StatusBadge tone="emerald">当前安排</StatusBadge>
          <div className="font-semibold text-slate-950">{selectedTemplateName}</div>
          <div className="rounded-lg bg-stone-50 p-3 text-slate-600">下次建议：{suggestedTemplateName}</div>
          <div className="rounded-lg bg-stone-50 p-3 text-slate-600">
            今日状态：睡眠 {todayStatus.sleep} / 精力 {todayStatus.energy} / {todayStatus.time} 分钟
          </div>
        </div>
      ) : null}

      {activeTab === 'training' ? (
        <div className="space-y-2 text-sm">
          <StatusBadge tone={activeSession ? 'emerald' : 'slate'}>{activeSession ? '训练中' : '未开始'}</StatusBadge>
          <div className="font-semibold text-slate-950">
            {activeSession ? formatTemplateName(activeSession.templateId || activeSession.templateName, '当前训练') : '暂无进行中的训练'}
          </div>
          <div className="rounded-lg bg-stone-50 p-3 text-slate-600">训练业务状态仍由 activeSession 和 workout state machine 管理。</div>
        </div>
      ) : null}

      {activeTab === 'record' ? (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="rounded-lg bg-stone-50 p-3">默认入口：训练日历。</div>
          <div className="rounded-lg bg-stone-50 p-3">历史详情、统计、PR、数据管理在记录页内切换。</div>
        </div>
      ) : null}

      {activeTab === 'plan' ? (
        <div className="space-y-2 text-sm">
          <StatusBadge tone="sky">当前模板</StatusBadge>
          <div className="font-semibold text-slate-950">{selectedTemplateName}</div>
          <div className="rounded-lg bg-stone-50 p-3 text-slate-600">实验模板、调整建议和回滚保留在计划页主内容。</div>
        </div>
      ) : null}

      {activeTab === 'profile' ? (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="rounded-lg bg-stone-50 p-3">当前位置：{profileSection === 'assessment' ? '身体 / 动作筛查' : '设置中心'}</div>
          <div className="rounded-lg bg-stone-50 p-3">健康数据、单位、备份和筛查集中在“我的”。</div>
        </div>
      ) : null}
    </Card>
  );
};

function App() {
  const [data, setData] = useState<AppData>(() => loadData() as AppData);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [expandedExercise, setExpandedExercise] = useState(0);
  const [, setTimerTick] = useState(0);
  const [bodyWeightInput, setBodyWeightInput] = useState('');
  const [preferFocusShell, setPreferFocusShell] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const [forceFullTrainingView, setForceFullTrainingView] = useState(false);
  const [progressTarget, setProgressTarget] = useState<{ section: ProgressSectionTarget; sessionId?: string; date?: string } | null>(null);
  const [profileSection, setProfileSection] = useState<ProfileSection>('home');
  const [profileTargetSection, setProfileTargetSection] = useState<ProfileTargetSection | null>(null);
  const [pendingSessionPatches, setPendingSessionPatches] = useState<SessionPatch[]>([]);
  const [appToast, setAppToast] = useState<AppToast | null>(null);
  const completeSetGuardRef = useRef<{ key: string; at: number } | null>(null);
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const showAppToast = (message: string, tone: AppToast['tone'] = 'info') => {
    setAppToast({ message, tone });
  };

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!appToast || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => setAppToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [appToast]);

  useEffect(() => {
    if (data.activeSession) setActiveTab('training');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setPreferFocusShell(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setForceFullTrainingView(false);
  }, [data.activeSession?.id]);

  useEffect(() => {
    if (!data.activeSession?.restTimerState?.isRunning) return undefined;
    const interval = window.setInterval(() => setTimerTick((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [data.activeSession?.restTimerState?.isRunning, data.activeSession?.restTimerState?.startedAt]);

  const activeTemplateId = data.activeProgramTemplateId || data.selectedTemplateId;
  const selectedTemplate = findTemplate(data.templates, activeTemplateId);
  const weeklyPrescription = buildWeeklyPrescription(data);
  const decisionContext = buildTrainingDecisionContext(data);
  const coachAutomationSummary = React.useMemo(() => buildCoachAutomationSummary(data), [data]);
  const trainingIntelligenceSummary = React.useMemo(() => {
    const analyticsHistory = filterAnalyticsHistory(data.history || []);
    const latestSession = [...analyticsHistory].sort((left, right) =>
      (right.finishedAt || right.startedAt || right.date || '').localeCompare(left.finishedAt || left.startedAt || left.date || ''),
    )[0];
    const effectiveSetSummary = buildEffectiveVolumeSummary(analyticsHistory);
    const weeklyVolumeSummary = buildMuscleVolumeDashboard(analyticsHistory, weeklyPrescription);
    return buildTrainingIntelligenceSummary({
      latestSession,
      history: analyticsHistory,
      weeklyVolumeSummary,
      effectiveSetSummary,
      loadFeedback: analyticsHistory.flatMap((session) => session.loadFeedback || []),
      trainingLevel: data.userProfile.trainingLevel,
    });
  }, [data.history, data.userProfile.trainingLevel, weeklyPrescription]);
  const baseSuggestedTemplateId = pickSuggestedTemplate(data, decisionContext);
  const baseSuggestedTemplate = findTemplate(data.templates, baseSuggestedTemplateId);
  const recoveryReadinessResult = React.useMemo(
    () =>
      applyStatusRules(
        baseSuggestedTemplate,
        decisionContext.todayStatus,
        decisionContext.trainingMode,
        weeklyPrescription,
        decisionContext.history,
        decisionContext.screeningProfile,
        decisionContext.mesocyclePlan,
        toStatusRulesDecisionContext(decisionContext),
      ).readinessResult,
    [
      baseSuggestedTemplate,
      decisionContext.todayStatus,
      decisionContext.trainingMode,
      weeklyPrescription,
      decisionContext.history,
      decisionContext.screeningProfile,
      decisionContext.mesocyclePlan,
      decisionContext.healthSummary,
      decisionContext.useHealthDataForReadiness,
    ],
  );
  const recoveryPainPatterns = React.useMemo(() => buildPainPatterns(filterAnalyticsHistory(data.history || [])), [data.history]);
  const recoveryRecommendation = React.useMemo(
    () =>
      buildRecoveryAwareRecommendation({
        preferredTemplate: baseSuggestedTemplate,
        templates: data.templates || [],
        sorenessAreas: (data.todayStatus?.soreness || []).filter((area) => area !== '无'),
        painAreas: recoveryPainPatterns.map((pattern) => pattern.area),
        readinessResult: recoveryReadinessResult,
        availableTimeMin: number(data.todayStatus?.time),
      }),
    [baseSuggestedTemplate, data.templates, data.todayStatus?.soreness, data.todayStatus?.time, recoveryPainPatterns, recoveryReadinessResult],
  );
  const suggestedTemplateId = recoveryRecommendation.templateId || baseSuggestedTemplateId;
  const suggestedTemplate = findTemplate(data.templates, suggestedTemplateId);
  const coachActions = React.useMemo(
    () =>
      buildCoachActions({
        appData: data,
        dailyAdjustment: coachAutomationSummary.todayAdjustment,
        nextWorkout: coachAutomationSummary.nextWorkout,
        dataHealthReport: coachAutomationSummary.dataHealth,
        sessionQuality: trainingIntelligenceSummary.sessionQuality,
        plateauResults: trainingIntelligenceSummary.plateauResults,
        volumeAdaptation: trainingIntelligenceSummary.volumeAdaptation,
        recommendationConfidence: trainingIntelligenceSummary.recommendationConfidence,
        recoveryRecommendation,
      }),
    [data, coachAutomationSummary, trainingIntelligenceSummary, recoveryRecommendation],
  );

  const startSession = (templateId = activeTemplateId, explicitPatches?: SessionPatch[]) => {
    const template = findTemplate(data.templates, templateId);
    const screeningProfile = reconcileScreeningProfile(data.screeningProfile, data.history);
    const workingData = { ...data, screeningProfile };
    const sessionDecisionContext = buildTrainingDecisionContext(workingData, { screeningProfile });
    const baseSession = createSession(
      template,
      data.todayStatus,
      data.history,
      data.trainingMode,
      weeklyPrescription,
      undefined,
      screeningProfile,
      data.mesocyclePlan,
      sessionDecisionContext
    ) as TrainingSession;
    const patches = explicitPatches ?? pendingSessionPatches;
    const patchResult = patches.length ? applySessionPatches(baseSession, patches) : null;
    const session = patchResult?.session || baseSession;

    setData((current) => ({
      ...current,
      screeningProfile,
      selectedTemplateId: templateId,
      activeProgramTemplateId: templateId,
      activeSession: session,
    }));
    if (patches.length) {
      setPendingSessionPatches([]);
      if (patchResult?.warnings.length) showAppToast(patchResult.warnings[0], 'warning');
    }
    setExpandedExercise(0);
    setActiveTab('training');
  };

  const finishSession = (target: ProgressSectionTarget | 'today' = 'list') => {
    if (!data.activeSession) return;
    const finishedAt = new Date().toISOString();
    const completed = completeTrainingSessionIntoHistory(data, finishedAt);
    const finishedSession = completed.session;

    setData((current) => {
      const result = completeTrainingSessionIntoHistory(current, finishedAt);
      return result.data;
    });

    if (finishedSession && target !== 'today') {
      setProgressTarget({ section: target, sessionId: finishedSession.id, date: finishedSession.date });
    }
    setActiveTab(target === 'today' ? 'today' : 'record');
  };

  const updateStatus = (field: StatusField, value: string) => {
    setData((current) => ({
      ...current,
      todayStatus: {
        ...current.todayStatus,
        [field]: value,
      },
    }));
  };

  const updateTrainingMode = (mode: TrainingMode) => {
    setData((current) => ({ ...current, trainingMode: mode }));
  };

  const toggleSoreness = (part: SorenessPart) => {
    setData((current) => {
      const currentList = current.todayStatus.soreness || ['无'];
      let next: TodayStatus['soreness'];
      if (part === '无') next = ['无'];
      else if (currentList.includes(part)) next = currentList.filter((item) => item !== part) as TodayStatus['soreness'];
      else next = [...currentList.filter((item) => item !== '无'), part] as TodayStatus['soreness'];
      if (!next.length) next = ['无'];
      return {
        ...current,
        todayStatus: {
          ...current.todayStatus,
          soreness: next,
        },
      };
    });
  };

  const updateActiveSet = (exerciseIndex: number, setIndex: number, field: EditableSetField, value: string | boolean) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const session = clone(current.activeSession) as TrainingSession;
      const sets = getSetList(session, exerciseIndex);
      const target = sets[setIndex];
      if (!target) return current;

      if (field === 'painFlag') target.painFlag = Boolean(value);
      else if (field === 'note') target.note = String(value);
      else if (field === 'weight' || field === 'reps') target[field] = Math.max(0, number(value));
      else if (field === 'techniqueQuality') target.techniqueQuality = String(value) as TrainingSetLog['techniqueQuality'];
      else target[field] = String(value);

      return { ...current, activeSession: session };
    });
  };

  const updateActiveSetFields = (exerciseIndex: number, setIndex: number, values: Partial<TrainingSetLog>) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const session = clone(current.activeSession) as TrainingSession;
      const sets = getSetList(session, exerciseIndex);
      const target = sets[setIndex];
      if (!target) return current;
      Object.assign(target, values);
      return { ...current, activeSession: session };
    });
  };

  const completeSet = (exerciseIndex: number, advanceExercise = false) => {
    const session = data.activeSession;
    if (!session) return;
    const step = getCurrentFocusStep(session);
    if (step.stepType === 'completed' || step.exerciseIndex !== exerciseIndex) return;

    const completedAt = new Date().toISOString();
    const now = Date.now();
    const guardKey = `${session.id}:${step.id}`;
    const lastGuard = completeSetGuardRef.current;
    if (lastGuard?.key === guardKey && now - lastGuard.at < 500) return;
    completeSetGuardRef.current = { key: guardKey, at: now };

    let nextExpandedExercise: number | null = null;

    setData((current) => {
      if (!current.activeSession) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, {
        type: 'COMPLETE_STEP',
        exerciseIndex,
        completedAt,
        nowMs: now,
        expectedStepId: step.id,
        displayUnit: current.unitSettings.weightUnit,
      });
      if (result.updatedSession === current.activeSession && result.warnings.length) return current;
      const nextStep = getCurrentFocusStep(result.updatedSession);
      nextExpandedExercise = result.nextState === 'completed' ? exerciseIndex : nextStep.exerciseIndex;
      return { ...current, activeSession: result.updatedSession };
    });

    if (nextExpandedExercise !== null && nextExpandedExercise >= 0) {
      setExpandedExercise(nextExpandedExercise);
    }
  };

  const copyPreviousSet = (exerciseIndex: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, { type: 'COPY_PREVIOUS_SET', exerciseIndex });
      return { ...current, activeSession: result.updatedSession };
    });
  };

  const adjustCurrentSet = (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, {
        type: field === 'weight' ? 'ADJUST_WEIGHT' : 'ADJUST_REPS',
        exerciseIndex,
        delta,
      });
      return { ...current, activeSession: result.updatedSession };
    });
  };

  const applyFocusSuggestion = (exerciseIndex: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, { type: 'APPLY_PRESCRIPTION', exerciseIndex });
      return { ...current, activeSession: result.updatedSession };
    });
  };

  const updateFocusDraft = (
    exerciseIndex: number,
    updates: Parameters<typeof updateFocusActualDraft>[2]
  ) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return { ...current, activeSession: updateFocusActualDraft(current.activeSession, exerciseIndex, updates) };
    });
  };

  const replaceExercise = (exerciseIndex: number, replacementId?: string) => {
    setData((current) => {
      if (!current.activeSession) return current;
      if (replacementId) {
        const result = dispatchWorkoutExecutionEvent(current.activeSession, { type: 'APPLY_REPLACEMENT', exerciseIndex, replacementId });
        return { ...current, activeSession: result.updatedSession };
      }
      const exercise = current.activeSession.exercises[exerciseIndex];
      const nextOption = exercise ? buildReplacementOptions(exercise)[0] : undefined;
      if (!nextOption) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, { type: 'APPLY_REPLACEMENT', exerciseIndex, replacementId: nextOption.id });
      return { ...current, activeSession: result.updatedSession };
    });
    setExpandedExercise(exerciseIndex);
  };

  const switchActiveExercise = (exerciseIndex: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return { ...current, activeSession: switchFocusExercise(current.activeSession, exerciseIndex) };
    });
    setExpandedExercise(exerciseIndex);
  };

  const deleteActiveSession = async (skipConfirm = false) => {
    const confirmed = skipConfirm ? true : await confirm({
        title: '放弃当前训练？',
        description: '当前未保存的训练记录将不会进入历史。',
        confirmText: '放弃训练',
        cancelText: '继续训练',
        variant: 'danger',
      });
    if (!confirmed) return;
    setData((current) => ({ ...current, activeSession: null }));
    setActiveTab('today');
  };

  const updateRestTimer = (updater: (timer: RestTimerState | null) => RestTimerState | null) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return {
        ...current,
        activeSession: {
          ...current.activeSession,
          restTimerState: updater(current.activeSession.restTimerState || null),
        },
      };
    });
  };

  const extendActiveRestTimer = (seconds: number) => updateRestTimer((timer) => extendRestTimer(timer, seconds));
  const toggleActiveRestTimer = () =>
    updateRestTimer((timer) => {
      if (!timer) return null;
      return timer.isRunning ? pauseRestTimer(timer) : resumeRestTimer(timer);
    });
  const clearActiveRestTimer = () => updateRestTimer(() => null);

  const updateSupportLog = (moduleId: string, exerciseId: string, updates: Partial<NonNullable<TrainingSession['supportExerciseLogs']>[number]>) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const session = clone(current.activeSession) as TrainingSession;
      session.supportExerciseLogs = Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [];
      const target = session.supportExerciseLogs.find((item) => item.moduleId === moduleId && item.exerciseId === exerciseId);
      if (!target) return current;
      Object.assign(target, updates);
      target.completedSets = Math.max(0, Math.min(number(target.completedSets), number(target.plannedSets)));
      return { ...current, activeSession: session };
    });
  };

  const completeSupportSet = (moduleId: string, exerciseId: string) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const step = getCurrentFocusStep(current.activeSession);
      if (step.moduleId !== moduleId || step.exerciseId !== exerciseId) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, {
        type: 'COMPLETE_STEP',
        exerciseIndex: step.exerciseIndex,
        completedAt: new Date().toISOString(),
        nowMs: Date.now(),
        expectedStepId: step.id,
        displayUnit: current.unitSettings.weightUnit,
      });
      return { ...current, activeSession: result.updatedSession };
    });
  };

  const skipSupportExercise = (moduleId: string, exerciseId: string, reason: SupportSkipReason) => {
    updateSupportLog(moduleId, exerciseId, {
      skippedReason: reason,
    });
  };

  const skipSupportBlock = (blockType: 'correction' | 'functional', reason: SupportSkipReason) => {
    setData((current) => {
      if (!current.activeSession) return current;
      const result = dispatchWorkoutExecutionEvent(current.activeSession, { type: 'SKIP_BLOCK', blockType, reason });
      return { ...current, activeSession: result.updatedSession };
    });
  };

  const recordLoadFeedback = (exerciseId: string, feedback: LoadFeedbackValue) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return {
        ...current,
        activeSession: upsertLoadFeedback(current.activeSession, exerciseId, feedback),
      };
    });
  };

  const updateTemplateExercise = (templateId: string, exerciseIndex: number, field: string, value: string) => {
    setData((current) => ({
      ...current,
      templates: current.templates.map((template) => {
        if (template.id !== templateId) return template;
        const exercises = template.exercises.map((exercise, index) =>
          index === exerciseIndex ? normalizeTemplateExerciseInput(exercise, field, value) : exercise
        );
        return { ...template, exercises: exercises.map((exercise) => enrichExercise(exercise)), updatedAt: new Date().toISOString() };
      }),
    }));
  };

  const saveBodyWeight = () => {
    const value = number(bodyWeightInput);
    if (!value) return;
    const date = todayKey();
    setData((current) => {
      const withoutToday = current.bodyWeights.filter((entry) => entry.date !== date);
      return {
        ...current,
        bodyWeights: [{ date, value }, ...withoutToday].sort((a, b) => b.date.localeCompare(a.date)),
      };
    });
    setBodyWeightInput('');
  };

  const resetTemplates = async () => {
    const confirmed = await confirm({
      title: '恢复默认模板？',
      description: '会重置当前模板配置，历史训练记录会保留。',
      confirmText: '恢复默认',
      cancelText: '取消',
      variant: 'warning',
    });
    if (!confirmed) return;
    setData((current) => ({
      ...current,
      templates: hydrateTemplates(INITIAL_TEMPLATES),
      selectedTemplateId: 'push-a',
      activeProgramTemplateId: 'push-a',
    }));
  };

  const applyProgramAdjustmentDraft = async (draft: ProgramAdjustmentDraft) => {
    const sourceTemplate = data.templates.find((template) => template.id === draft.sourceProgramTemplateId);
    if (!sourceTemplate) {
      showAppToast('找不到建议来源模板，暂时不能生成实验模板。', 'warning');
      return;
    }
    const activeExperiment = data.programAdjustmentHistory?.find(
      (item) => item.rollbackAvailable && item.experimentalProgramTemplateId === data.activeProgramTemplateId
    );
    if (activeExperiment && activeExperiment.experimentalProgramTemplateId !== draft.sourceProgramTemplateId) {
      const replace = await confirm({
        title: '应用实验模板？',
        description: '不会覆盖原模板，会生成或切换到实验模板，可回滚。',
        confirmText: '应用',
        cancelText: '取消',
        variant: 'default',
      });
      if (!replace) return;
    }

    let result: Awaited<ReturnType<(typeof import('./engines/programAdjustmentEngine'))['applyAdjustmentDraft']>>;
    try {
      const { applyAdjustmentDraft } = await import('./engines/programAdjustmentEngine');
      result = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
    } catch {
      showAppToast('计划调整功能暂时无法加载，请稍后再试。', 'danger');
      return;
    }
    if (!result.ok || !result.experimentalTemplate || !result.historyItem || !result.updatedProgramTemplate) {
      setData((current) => ({
        ...current,
        programAdjustmentDrafts: [
          ...(current.programAdjustmentDrafts || []).filter((item) => item.id !== draft.id),
          result.draft,
        ],
      }));
      showAppToast(result.message || '计划调整失败，请重新生成预览。', 'danger');
      return;
    }

    const { experimentalTemplate, historyItem, updatedProgramTemplate } = result;
    setData((current) => ({
      ...current,
      templates: [...current.templates.filter((template) => template.id !== experimentalTemplate.id), experimentalTemplate],
      selectedTemplateId: experimentalTemplate.id,
      activeProgramTemplateId: experimentalTemplate.id,
      programTemplate: updatedProgramTemplate,
      programAdjustmentDrafts: [
        ...(current.programAdjustmentDrafts || []).filter((item) => item.id !== draft.id),
        result.draft,
      ],
      programAdjustmentHistory: [historyItem, ...(current.programAdjustmentHistory || [])],
    }));
    showAppToast('已生成下周实验模板。', 'success');
  };

  const rollbackProgramAdjustment = async (historyItemId: string) => {
    const historyItem = data.programAdjustmentHistory?.find((item) => item.id === historyItemId);
    if (!historyItem) return;
    let rollbackResult: ReturnType<(typeof import('./engines/programAdjustmentEngine'))['rollbackAdjustment']>;
    try {
      const { rollbackAdjustment } = await import('./engines/programAdjustmentEngine');
      rollbackResult = rollbackAdjustment(historyItem);
    } catch {
      showAppToast('计划调整功能暂时无法加载，请稍后再试。', 'danger');
      return;
    }
    const { restoredTemplateId, restoredProgramTemplate, updatedHistoryItem } = rollbackResult;
    setData((current) => ({
      ...current,
      selectedTemplateId: restoredTemplateId,
      activeProgramTemplateId: restoredTemplateId,
      programTemplate: restoredProgramTemplate || current.programTemplate,
      programAdjustmentHistory: (current.programAdjustmentHistory || []).map((item) =>
        item.id === updatedHistoryItem.id ? updatedHistoryItem : item
      ),
    }));
    showAppToast('已回滚到原模板。', 'success');
  };

  const updateUserProfile = (field: string, value: string) => {
    setData((current) => ({
      ...current,
      userProfile: {
        ...current.userProfile,
        [field]: ['age', 'heightCm', 'weightKg', 'weeklyTrainingDays', 'sessionDurationMin'].includes(field) ? number(value) : value,
      },
      trainingMode:
        field === 'primaryGoal' && value === 'hypertrophy'
          ? 'hypertrophy'
          : field === 'primaryGoal' && value === 'strength'
            ? 'strength'
            : current.trainingMode,
      programTemplate:
        field === 'primaryGoal'
          ? { ...current.programTemplate, primaryGoal: value as AppData['programTemplate']['primaryGoal'] }
          : current.programTemplate,
    }));
  };

  const updateProgramTemplate = (field: string, value: string) => {
    setData((current) => ({
      ...current,
      programTemplate: {
        ...current.programTemplate,
        [field]: field === 'daysPerWeek' ? number(value) : value,
      },
    }));
  };

  const updateScreeningFlag = (group: 'postureFlags' | 'movementFlags', field: string, value: string) => {
    setData((current) => {
      const screening = reconcileScreeningProfile(
        {
          ...current.screeningProfile,
          [group]: {
            ...current.screeningProfile[group],
            [field]: value,
          },
        },
        current.history
      );
      return { ...current, screeningProfile: screening };
    });
  };

  const deleteHistorySession = (sessionId: string) => {
    setData((current) => {
      const result = deleteTrainingSession(current, sessionId, true);
      return result.data;
    });
  };

  const updateUnitSettings = (updates: Partial<UnitSettings>) => {
    setData((current) => {
      const unitSettings = sanitizeUnitSettings({ ...current.unitSettings, ...updates });
      return {
        ...current,
        unitSettings,
        settings: {
          ...current.settings,
          unitSettings,
        },
      };
    });
  };

  const updateHistorySessionFlag = (sessionId: string, dataFlag: SessionDataFlag) => {
    setData((current) => markSessionDataFlag(current, sessionId, dataFlag, true).data);
  };

  const editHistorySession = (session: TrainingSession) => {
    setData((current) => {
      const history = (current.history || []).map((item) => (item.id === session.id ? session : item));
      return {
        ...current,
        history,
        screeningProfile: reconcileScreeningProfile(current.screeningProfile, history),
      };
    });
  };

  const openProfileTarget = (target: ProfileTargetSection) => {
    setProfileSection('home');
    setProfileTargetSection(target);
    setActiveTab('profile');
  };

  const handleDataHealthAction = (action: DataHealthActionView) => {
    if (!action || action.type === 'none') return;
    if (action.type === 'dismiss') {
      showAppToast('已忽略此提醒。', 'info');
      return;
    }
    if (action.type === 'open_session_detail') {
      if (action.targetId) {
        const session = (data.history || []).find((item) => item.id === action.targetId);
        if (session) {
          setProgressTarget({ section: 'list', sessionId: session.id, date: session.date || action.targetDate });
          setActiveTab('record');
          showAppToast('已打开相关训练。', 'info');
          return;
        }
        showAppToast('暂时无法定位到对应记录。', 'warning');
      }
      setProgressTarget({ section: 'list', date: action.targetDate });
      setActiveTab('record');
      return;
    }
    if (action.type === 'open_record_history') {
      setProgressTarget({ section: 'list', ...(action.targetDate ? { date: action.targetDate } : {}) });
      setActiveTab('record');
      showAppToast('已打开历史训练。', 'info');
      return;
    }
    if (action.type === 'open_record_data') {
      setProgressTarget({ section: 'data' });
      setActiveTab('record');
      showAppToast('已打开数据分区。', 'info');
      return;
    }
    if (action.type === 'open_health_data') {
      openProfileTarget('health_data');
      showAppToast('已定位到健康数据导入。', 'info');
      return;
    }
    if (action.type === 'open_unit_settings') {
      openProfileTarget('unit_settings');
      showAppToast('已定位到单位设置。', 'info');
      return;
    }
    if (action.type === 'open_plan') {
      setActiveTab('plan');
      showAppToast('已打开计划页。', 'info');
      return;
    }
    if (action.type === 'open_backup') {
      openProfileTarget('data_management');
      showAppToast('已定位到备份与恢复。', 'info');
    }
  };

  const handleCoachAction = (action: CoachAction) => {
    if (!action) return;
    if (action.actionType === 'open_data_health') {
      if (action.targetType === 'plan') {
        setActiveTab('plan');
        showAppToast('已打开计划页查看相关问题。', 'info');
        return;
      }
      if (action.targetType === 'session' && action.targetId) {
        const session = (data.history || []).find((item) => item.id === action.targetId);
        if (session) {
          setProgressTarget({ section: 'list', sessionId: session.id, date: session.date });
          setActiveTab('record');
          showAppToast('已打开相关训练详情。', 'info');
          return;
        }
      }
      openProfileTarget('health_data');
      showAppToast('已打开数据健康检查。', 'info');
      return;
    }
    if (action.actionType === 'open_record_detail' || action.actionType === 'review_session') {
      if (action.targetId) {
        const session = (data.history || []).find((item) => item.id === action.targetId);
        if (session) {
          setProgressTarget({ section: 'list', sessionId: session.id, date: session.date });
          setActiveTab('record');
          showAppToast('已打开训练详情。', 'info');
          return;
        }
        showAppToast('暂时无法定位到对应记录。', 'warning');
      }
      setProgressTarget({ section: 'list' });
      setActiveTab('record');
      return;
    }
    if (
      action.actionType === 'create_plan_adjustment_preview' ||
      action.actionType === 'review_volume' ||
      action.actionType === 'review_exercise'
    ) {
      setActiveTab('plan');
      showAppToast(
        action.actionType === 'create_plan_adjustment_preview'
          ? '已打开计划页；这里只引导生成草案，不会自动应用。'
          : '已打开计划页查看相关建议。',
        'info',
      );
      return;
    }
    if (action.actionType === 'open_next_workout') {
      setActiveTab('today');
      showAppToast('已打开今日页查看下次训练建议。', 'info');
      return;
    }
    if (action.actionType === 'apply_temporary_session_adjustment') {
      if (action.source !== 'dailyAdjustment') {
        setActiveTab('today');
        showAppToast('已打开今日页查看恢复建议。', 'info');
        return;
      }
      const patches = buildSessionPatchesFromDailyAdjustment(coachAutomationSummary.todayAdjustment);
      if (!patches.length) {
        showAppToast('当前没有可应用的本次临时调整。', 'info');
        return;
      }
      void (async () => {
        const confirmed = await confirm({
          title: '采用本次临时调整？',
          description: '只影响本次训练，不会修改原计划。',
          confirmText: '采用',
          cancelText: '取消',
          variant: 'warning',
        });
        if (!confirmed) return;
        if (data.activeSession) {
          setData((current) => {
            if (!current.activeSession) return current;
            const result = applySessionPatches(current.activeSession, patches);
            return { ...current, activeSession: result.session };
          });
        } else {
          setPendingSessionPatches(patches);
        }
        setActiveTab(data.activeSession ? 'training' : 'today');
        showAppToast(data.activeSession ? '已应用本次临时调整。' : '已应用本次临时调整。开始训练时生效。', 'success');
      })();
      return;
    }
    if (action.actionType === 'keep_observing') {
      setActiveTab('today');
      showAppToast('已打开今日页查看建议；不会自动修改训练。', 'info');
      return;
    }
    if (action.actionType === 'open_replacement_sheet') {
      setActiveTab(data.activeSession ? 'training' : 'today');
      showAppToast('请在训练页打开替代动作列表。', 'info');
      return;
    }
    if (action.actionType === 'dismiss') {
      showAppToast('已暂不处理。', 'info');
      return;
    }
    showAppToast('已记录为继续观察。', 'info');
  };

  const dismissCoachAction = (_action: CoachAction) => {
    showAppToast('已暂不处理。', 'info');
  };

  const revertTemporarySessionPatches = () => {
    if (data.activeSession?.appliedCoachActions?.length) {
      const patchIds = data.activeSession.appliedCoachActions.map((patch) => patch.id);
      setData((current) => {
        if (!current.activeSession) return current;
        const result = revertSessionPatches(current.activeSession, patchIds);
        return { ...current, activeSession: result.session };
      });
      showAppToast('已撤销本次临时调整。', 'success');
      return;
    }
    if (pendingSessionPatches.length) {
      setPendingSessionPatches([]);
      showAppToast('已撤销本次临时调整。', 'success');
      return;
    }
    showAppToast('当前没有可撤销的本次调整。', 'info');
  };

  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'profile') {
      setProfileSection('home');
      setProfileTargetSection(null);
    }
  };

  const useFocusTrainingShell = activeTab === 'training' && data.activeSession && preferFocusShell && !forceFullTrainingView;

  return (
    <>
      <AppShell
        navItems={navItems}
        activeTab={activeTab}
        onNavigate={navigate}
        activeSession={Boolean(data.activeSession)}
        immersive={Boolean(useFocusTrainingShell)}
        auxiliary={
          <AppAuxiliaryPanel
            activeTab={activeTab}
            activeSession={data.activeSession}
            selectedTemplateName={formatTemplateName(selectedTemplate)}
            suggestedTemplateName={formatTemplateName(suggestedTemplate)}
            profileSection={profileSection}
            todayStatus={data.todayStatus}
          />
        }
      >
                {activeTab === 'today' && (
                  <TodayView
                    data={data}
                    selectedTemplate={selectedTemplate}
                    suggestedTemplate={suggestedTemplate}
                    recoveryRecommendation={recoveryRecommendation}
                    weeklyPrescription={weeklyPrescription}
                    coachAutomationSummary={coachAutomationSummary}
                    coachActions={coachActions}
                    onCoachAction={handleCoachAction}
                    onDismissCoachAction={dismissCoachAction}
                    temporarySessionAdjustmentActive={Boolean(pendingSessionPatches.length || data.activeSession?.appliedCoachActions?.length)}
                    onRevertTemporarySessionPatches={revertTemporarySessionPatches}
                    trainingIntelligenceSummary={trainingIntelligenceSummary}
                    trainingMode={data.trainingMode}
                    onModeChange={updateTrainingMode}
                    onStatusChange={updateStatus}
                    onSorenessToggle={toggleSoreness}
                    onTemplateSelect={(id) => setData((current) => ({ ...current, selectedTemplateId: id, activeProgramTemplateId: id }))}
                    onUseSuggestion={() => setData((current) => ({ ...current, selectedTemplateId: suggestedTemplateId, activeProgramTemplateId: suggestedTemplateId }))}
                    onStart={() => startSession()}
                    onStartRecommended={(templateId) => startSession(templateId)}
                    onResume={() => setActiveTab('training')}
                    onViewSession={(sessionId, date) => {
                      setProgressTarget({ section: 'list', sessionId, date });
                      setActiveTab('record');
                    }}
                    onViewCalendar={(date) => {
                      setProgressTarget({ section: 'calendar', date });
                      setActiveTab('record');
                    }}
                    onReviewDataHealth={() => {
                      setProgressTarget({ section: 'data' });
                      setActiveTab('record');
                    }}
                  />
                )}

                {activeTab === 'training' && useFocusTrainingShell && data.activeSession && (
                  <>
                    {false && (
                    <PageHeader
                      eyebrow="训练"
                      title={formatTemplateName(data.activeSession?.templateId || data.activeSession?.templateName, '训练')}
                      description="手机端优先使用极简模式记录训练。"
                      action={
                      <div className="flex flex-wrap gap-2">
                        <ActionButton type="button" onClick={() => setForceFullTrainingView(true)} variant="secondary">
                          完整训练页
                        </ActionButton>
                        <ActionButton type="button" onClick={() => void deleteActiveSession()} variant="danger">
                          放弃
                        </ActionButton>
                        <ActionButton type="button" onClick={() => finishSession()} variant="primary">
                          完成训练
                        </ActionButton>
                      </div>
                      }
                    />
                    )}
                    <TrainingFocusView
                      session={data.activeSession}
                      unitSettings={data.unitSettings}
                      restTimer={data.activeSession.restTimerState || null}
                      expandedExercise={expandedExercise}
                      setExpandedExercise={setExpandedExercise}
                      onSetChange={updateActiveSet}
                      onCompleteSet={completeSet}
                      onCopyPrevious={copyPreviousSet}
                      onAdjustSet={adjustCurrentSet}
                      onApplySuggestion={applyFocusSuggestion}
                      onUpdateActualDraft={updateFocusDraft}
                      onSwitchExercise={switchActiveExercise}
                      onReplaceExercise={replaceExercise}
                      onLoadFeedback={recordLoadFeedback}
                      onFinish={finishSession}
                      onFinishToCalendar={() => finishSession('calendar')}
                      onFinishToToday={() => finishSession('today')}
                      onShowFullTraining={() => setForceFullTrainingView(true)}
                      onCompleteSupportSet={completeSupportSet}
                      onSkipSupportExercise={skipSupportExercise}
                      onSkipSupportBlock={skipSupportBlock}
                      onUpdateSupportSkipReason={skipSupportExercise}
                      trainingHistory={decisionContext.history}
                      equipmentPreferences={data.userProfile.equipmentAccess}
                    />
                  </>
                )}

                {activeTab === 'training' && !useFocusTrainingShell && (
                  <Suspense fallback={<LazyPageFallback />}>
                    <TrainingView
                      session={data.activeSession}
                      unitSettings={data.unitSettings}
                      restTimer={data.activeSession?.restTimerState || null}
                      expandedExercise={expandedExercise}
                      setExpandedExercise={setExpandedExercise}
                      onStartFromSelected={() => startSession()}
                      onSetChange={updateActiveSet}
                      onCompleteSet={completeSet}
                      onCopyPrevious={copyPreviousSet}
                      onAdjustSet={adjustCurrentSet}
                      onApplySuggestion={applyFocusSuggestion}
                      onUpdateActualDraft={updateFocusDraft}
                      onSwitchExercise={switchActiveExercise}
                      onCompleteSupportSet={completeSupportSet}
                      onSkipSupportExercise={skipSupportExercise}
                      onSkipSupportBlock={skipSupportBlock}
                      onUpdateSupportSkipReason={skipSupportExercise}
                      onReplaceExercise={replaceExercise}
                      onLoadFeedback={recordLoadFeedback}
                      onFinish={finishSession}
                      onFinishToCalendar={() => finishSession('calendar')}
                      onFinishToToday={() => finishSession('today')}
                      onDelete={() => void deleteActiveSession(true)}
                      onReturnFocusMode={() => setForceFullTrainingView(false)}
                      onExtendRestTimer={extendActiveRestTimer}
                      onToggleRestTimer={toggleActiveRestTimer}
                      onClearRestTimer={clearActiveRestTimer}
                      onGoToday={() => setActiveTab('today')}
                    />
                  </Suspense>
                )}

                {activeTab === 'plan' && (
                  <Suspense fallback={<LazyPageFallback />}>
                    <PlanView
                      data={data}
                      weeklyPrescription={weeklyPrescription}
                      trainingIntelligenceSummary={trainingIntelligenceSummary}
                      coachActions={coachActions}
                      onCoachAction={handleCoachAction}
                      onDismissCoachAction={dismissCoachAction}
                      selectedTemplateId={activeTemplateId}
                      onSelectTemplate={(id) => setData((current) => ({ ...current, selectedTemplateId: id, activeProgramTemplateId: id }))}
                      onStartTemplate={(id) => startSession(id)}
                      onUpdateExercise={updateTemplateExercise}
                      onResetTemplates={resetTemplates}
                      onRollbackProgramAdjustment={rollbackProgramAdjustment}
                    />
                  </Suspense>
                )}

                {activeTab === 'record' && (
                  <Suspense fallback={<LazyPageFallback />}>
                    <RecordView
                      data={data}
                      unitSettings={data.unitSettings}
                      coachAutomationSummary={coachAutomationSummary}
                      trainingIntelligenceSummary={trainingIntelligenceSummary}
                      coachActions={coachActions}
                      onCoachAction={handleCoachAction}
                      onDismissCoachAction={dismissCoachAction}
                      weeklyPrescription={weeklyPrescription}
                      bodyWeightInput={bodyWeightInput}
                      setBodyWeightInput={setBodyWeightInput}
                      onSaveBodyWeight={saveBodyWeight}
                      onDeleteSession={deleteHistorySession}
                      onMarkSessionDataFlag={updateHistorySessionFlag}
                      onEditSession={editHistorySession}
                      onUpdateUnitSettings={updateUnitSettings}
                      onRestoreData={(nextData) => {
                        setData(nextData);
                        setActiveTab('today');
                      }}
                      onApplyProgramAdjustmentDraft={applyProgramAdjustmentDraft}
                      onRollbackProgramAdjustment={rollbackProgramAdjustment}
                      onDataHealthAction={handleDataHealthAction}
                      onStartTraining={() => startSession()}
                      initialSection={progressTarget?.section}
                      selectedSessionId={progressTarget?.sessionId}
                      selectedDate={progressTarget?.date}
                    />
                  </Suspense>
                )}

                {activeTab === 'profile' && profileSection === 'home' && (
                  <Suspense fallback={<LazyPageFallback />}>
                    <ProfileView
                      data={data}
                      unitSettings={data.unitSettings}
                      coachAutomationSummary={coachAutomationSummary}
                      coachActions={coachActions}
                      onCoachAction={handleCoachAction}
                      onDismissCoachAction={dismissCoachAction}
                      onUpdateUnitSettings={updateUnitSettings}
                      onRestoreData={(nextData) => {
                        setData(nextData);
                        setActiveTab('today');
                      }}
                      onUpdateHealthData={(nextData) => setData(nextData)}
                      onOpenAssessment={() => setProfileSection('assessment')}
                      onDataHealthAction={handleDataHealthAction}
                      targetSection={profileTargetSection}
                      onOpenRecordData={() => {
                        setProgressTarget({ section: 'data' });
                        setActiveTab('record');
                      }}
                    />
                  </Suspense>
                )}

                {activeTab === 'profile' && profileSection === 'assessment' && (
                  <Suspense fallback={<LazyPageFallback />}>
                    <AssessmentView
                      data={data}
                      onProfileChange={updateUserProfile}
                      onProgramChange={updateProgramTemplate}
                      onScreeningChange={updateScreeningFlag}
                      onGoProgram={() => {
                        setProfileSection('home');
                        setActiveTab('plan');
                      }}
                    />
                  </Suspense>
                )}
      </AppShell>
      <ConfirmDialogHost />
      {appToast ? (
        <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <Toast tone={appToast.tone}>{appToast.message}</Toast>
        </div>
      ) : null}
      <AddToHomeScreenHint />
    </>
  );
}

export default App;
