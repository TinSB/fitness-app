import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, Dumbbell, Flame, UserCircle } from 'lucide-react';
import { INITIAL_TEMPLATES } from './data/trainingData';
import { TodayView } from './features/TodayView';
import { TrainingFocusView } from './features/TrainingFocusView';
import { buildWeeklyPrescription } from './engines/supportPlanEngine';
import { classNames, clone, enrichExercise, findTemplate, hydrateTemplates, number, todayKey } from './engines/engineUtils';
import { createSession, pickSuggestedTemplate } from './engines/sessionBuilder';
import {
  extendRestTimer,
  pauseRestTimer,
  resumeRestTimer,
} from './engines/restTimerEngine';
import { reconcileScreeningProfile } from './engines/adaptiveFeedbackEngine';
import { normalizeTemplateExerciseInput } from './engines/exercisePrescriptionEngine';
import {
  applySuggestedFocusStep,
  adjustFocusSetValue,
  completeFocusSet,
  copyPreviousFocusActualDraft,
  getCurrentFocusStep,
  skipFocusSupportBlock,
  switchFocusExercise,
  updateFocusActualDraft,
} from './engines/focusModeStateEngine';
import { upsertLoadFeedback } from './engines/loadFeedbackEngine';
import { deleteTrainingSession, markSessionDataFlag } from './engines/sessionHistoryEngine';
import { completeTrainingSessionIntoHistory } from './engines/trainingCompletionEngine';
import { sanitizeUnitSettings } from './engines/unitConversionEngine';
import { applyExerciseReplacement } from './engines/replacementEngine';
import type { AppData, LoadFeedbackValue, ProgramAdjustmentDraft, RestTimerState, SessionDataFlag, SupportSkipReason, TrainingMode, TrainingSession, TrainingSetLog, TodayStatus, UnitSettings } from './models/training-model';
import { loadData, saveData } from './storage/persistence';
import { AddToHomeScreenHint } from './ui/AddToHomeScreenHint';
import { Page } from './ui/common';

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
type ProgressSectionTarget = 'dashboard' | 'calendar' | 'history' | 'pr' | 'data';
type ProfileSection = 'home' | 'assessment';
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
  const completeSetGuardRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

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
  const suggestedTemplateId = pickSuggestedTemplate(data);
  const suggestedTemplate = findTemplate(data.templates, suggestedTemplateId);

  const startSession = (templateId = activeTemplateId) => {
    const template = findTemplate(data.templates, templateId);
    const screeningProfile = reconcileScreeningProfile(data.screeningProfile, data.history);
    const workingData = { ...data, screeningProfile };
    const session = createSession(
      template,
      data.todayStatus,
      data.history,
      data.trainingMode,
      weeklyPrescription,
      undefined,
      screeningProfile,
      data.mesocyclePlan
    ) as TrainingSession;

    setData((current) => ({
      ...current,
      screeningProfile,
      selectedTemplateId: templateId,
      activeProgramTemplateId: templateId,
      activeSession: session,
    }));
    setExpandedExercise(0);
    setActiveTab('training');
  };

  const finishSession = (target: ProgressSectionTarget | 'today' = 'history') => {
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
      const result = completeFocusSet(current.activeSession, exerciseIndex, completedAt, now, step.id, current.unitSettings.weightUnit);
      if (!result) return current;
      nextExpandedExercise = result.sessionComplete ? exerciseIndex : result.nextExerciseIndex;
      return { ...current, activeSession: result.session };
    });

    if (nextExpandedExercise !== null && nextExpandedExercise >= 0) {
      setExpandedExercise(nextExpandedExercise);
    }
  };

  const copyPreviousSet = (exerciseIndex: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return { ...current, activeSession: copyPreviousFocusActualDraft(current.activeSession, exerciseIndex) };
    });
  };

  const adjustCurrentSet = (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return { ...current, activeSession: adjustFocusSetValue(current.activeSession, exerciseIndex, field, delta) };
    });
  };

  const applyFocusSuggestion = (exerciseIndex: number) => {
    setData((current) => {
      if (!current.activeSession) return current;
      return { ...current, activeSession: applySuggestedFocusStep(current.activeSession, exerciseIndex) };
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
        return { ...current, activeSession: switchFocusExercise(applyExerciseReplacement(current.activeSession, exerciseIndex, replacementId), exerciseIndex) };
      }
      const session = clone(current.activeSession) as TrainingSession;
      const exercise = session.exercises[exerciseIndex] as TrainingSession['exercises'][number] & {
        replacedFromId?: string;
        replacedFromName?: string;
      };
      const options = [exercise.originalName || exercise.name, ...(exercise.alternatives || [])].filter(Boolean);
      if (!options.length) return current;
      const currentIndex = options.indexOf(exercise.name);
      const nextIndex = (currentIndex + 1 + options.length) % options.length;
      const nextName = options[nextIndex];
      const baseId = exercise.baseId || exercise.id;
      exercise.name = nextName;
      exercise.id = nextIndex === 0 ? baseId : `${baseId}__alt_${nextIndex}`;
      exercise.canonicalExerciseId = nextIndex === 0 ? baseId : exercise.id;
      exercise.replacedFromId = nextIndex === 0 ? '' : baseId;
      exercise.replacedFromName = nextIndex === 0 ? '' : exercise.originalName;
      const replacementNotice = '已切到替代动作：这次仍属于同一模板位置，但 PR 会独立统计。';
      const warningParts = String(exercise.warning || '')
        .split(' / ')
        .map((item) => item.trim())
        .filter((item) => item && item !== replacementNotice);
      exercise.warning = nextIndex === 0 ? warningParts.join(' / ') : [...warningParts, replacementNotice].join(' / ');
      return { ...current, activeSession: switchFocusExercise(session, exerciseIndex) };
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

  const deleteActiveSession = () => {
    if (!window.confirm('确定放弃当前训练吗？未完成的数据不会进入历史记录。')) return;
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
      const session = clone(current.activeSession) as TrainingSession;
      session.supportExerciseLogs = Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [];
      const target = session.supportExerciseLogs.find((item) => item.moduleId === moduleId && item.exerciseId === exerciseId);
      if (!target) return current;
      target.completedSets = Math.max(0, Math.min(number(target.completedSets) + 1, number(target.plannedSets)));
      if (target.completedSets >= target.plannedSets) target.skippedReason = undefined;
      return { ...current, activeSession: session };
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
      return { ...current, activeSession: skipFocusSupportBlock(current.activeSession, blockType, reason) };
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

  const resetTemplates = () => {
    if (!window.confirm('确定恢复默认模板吗？历史训练记录会保留。')) return;
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
      window.alert('找不到建议来源模板，暂时不能生成实验模板。');
      return;
    }
    const activeExperiment = data.programAdjustmentHistory?.find(
      (item) => item.rollbackAvailable && item.experimentalProgramTemplateId === data.activeProgramTemplateId
    );
    if (activeExperiment && activeExperiment.experimentalProgramTemplateId !== draft.sourceProgramTemplateId) {
      const replace = window.confirm('当前已经启用了一个实验模板。是否用新的下周实验模板替换当前实验模板？原实验记录会保留，可回滚。');
      if (!replace) return;
    }

    let result: Awaited<ReturnType<(typeof import('./engines/programAdjustmentEngine'))['applyAdjustmentDraft']>>;
    try {
      const { applyAdjustmentDraft } = await import('./engines/programAdjustmentEngine');
      result = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
    } catch {
      window.alert('计划调整引擎加载失败，请稍后重试。');
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
      window.alert(result.message || '原模板已变化，请重新生成调整预览。');
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
    window.alert('已生成下周实验模板，并切换为当前计划。');
  };

  const rollbackProgramAdjustment = async (historyItemId: string) => {
    const historyItem = data.programAdjustmentHistory?.find((item) => item.id === historyItemId);
    if (!historyItem) return;
    if (!window.confirm('确定回滚到原模板吗？实验模板不会删除，历史记录会标记为已回滚。')) return;
    let rollbackResult: ReturnType<(typeof import('./engines/programAdjustmentEngine'))['rollbackAdjustment']>;
    try {
      const { rollbackAdjustment } = await import('./engines/programAdjustmentEngine');
      rollbackResult = rollbackAdjustment(historyItem);
    } catch {
      window.alert('回滚引擎加载失败，请稍后重试。');
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
    const confirmed = window.confirm('删除后该训练不会计入进度、e1RM、PR、完成度和日历。此操作不可恢复，建议先导出备份。确定删除吗？');
    setData((current) => {
      const result = deleteTrainingSession(current, sessionId, confirmed);
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
    const confirmed =
      dataFlag === 'normal' ||
      window.confirm('标记为测试/排除后，该训练不会计入进度、e1RM、PR、完成度和日历。确定继续吗？');
    setData((current) => markSessionDataFlag(current, sessionId, dataFlag, confirmed).data);
  };

  const useFocusTrainingShell = activeTab === 'training' && data.activeSession && preferFocusShell && !forceFullTrainingView;

  return (
    <div className="h-screen w-full overflow-hidden bg-stone-100 font-sans text-slate-900">
      <div className="h-full w-full md:p-3">
        <div className="h-full w-full overflow-hidden bg-white md:border md:border-slate-200 md:shadow-xl">
          <div className="flex h-full">
            <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-white md:flex">
              <div className="border-b border-white/10 px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500 text-slate-950">
                    <Dumbbell className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-lg font-black tracking-tight">IronPath</div>
                    <div className="text-xs text-slate-400">给自己用的训练工作台</div>
                  </div>
                </div>
              </div>

              <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const selected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (item.id === 'profile') setProfileSection('home');
                      }}
                      className={classNames(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition',
                        selected ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                      {item.id === 'training' && data.activeSession && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-white/10 px-6 py-5 text-xs leading-5 text-slate-400">打开就能开练。记录、处方、纠偏和趋势都保存在本地。</div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col bg-stone-50">
              <div className="flex min-h-[calc(56px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 pt-[env(safe-area-inset-top)] md:hidden">
                <div className="flex items-center gap-2 font-black">
                  <Dumbbell className="h-5 w-5 text-emerald-600" />
                  IronPath
                </div>
                {data.activeSession && (
                  <button onClick={() => setActiveTab('training')} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                    训练中
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-0">
                {activeTab === 'today' && (
                  <TodayView
                    data={data}
                    selectedTemplate={selectedTemplate}
                    suggestedTemplate={suggestedTemplate}
                    weeklyPrescription={weeklyPrescription}
                    trainingMode={data.trainingMode}
                    onModeChange={updateTrainingMode}
                    onStatusChange={updateStatus}
                    onSorenessToggle={toggleSoreness}
                    onTemplateSelect={(id) => setData((current) => ({ ...current, selectedTemplateId: id, activeProgramTemplateId: id }))}
                    onUseSuggestion={() => setData((current) => ({ ...current, selectedTemplateId: suggestedTemplateId, activeProgramTemplateId: suggestedTemplateId }))}
                    onStart={() => startSession()}
                    onResume={() => setActiveTab('training')}
                  />
                )}

                {activeTab === 'training' && useFocusTrainingShell && data.activeSession && (
                  <Page
                    eyebrow="训练"
                    title={data.activeSession.templateName}
                    action={
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setForceFullTrainingView(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                          完整训练页
                        </button>
                        <button onClick={deleteActiveSession} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-700">
                          放弃
                        </button>
                        <button onClick={() => finishSession()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">
                          完成训练
                        </button>
                      </div>
                    }
                  >
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
                      onCompleteSupportSet={completeSupportSet}
                      onSkipSupportExercise={skipSupportExercise}
                      onSkipSupportBlock={skipSupportBlock}
                      onUpdateSupportSkipReason={skipSupportExercise}
                    />
                  </Page>
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
                      onDelete={deleteActiveSession}
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
                      weeklyPrescription={weeklyPrescription}
                      bodyWeightInput={bodyWeightInput}
                      setBodyWeightInput={setBodyWeightInput}
                      onSaveBodyWeight={saveBodyWeight}
                      onDeleteSession={deleteHistorySession}
                      onMarkSessionDataFlag={updateHistorySessionFlag}
                      onUpdateUnitSettings={updateUnitSettings}
                      onRestoreData={(nextData) => {
                        setData(nextData);
                        setActiveTab('today');
                      }}
                      onApplyProgramAdjustmentDraft={applyProgramAdjustmentDraft}
                      onRollbackProgramAdjustment={rollbackProgramAdjustment}
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
                      onUpdateUnitSettings={updateUnitSettings}
                      onRestoreData={(nextData) => {
                        setData(nextData);
                        setActiveTab('today');
                      }}
                      onOpenAssessment={() => setProfileSection('assessment')}
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
              </div>
            </main>
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'profile') setProfileSection('home');
              }}
              className={classNames(
                'mx-0.5 my-1 flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition',
                selected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              )}
            >
              <Icon className="h-5 w-5 stroke-[2]" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <AddToHomeScreenHint />
    </div>
  );
}

export default App;
