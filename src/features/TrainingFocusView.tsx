import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Replace, SkipForward, Timer } from 'lucide-react';
import { classNames, formatTimer, number } from '../engines/engineUtils';
import { dedupeFocusNotices, getFocusNavigationState } from '../engines/focusModeStateEngine';
import { getRestTimerRemainingSec } from '../engines/restTimerEngine';
import { convertKgToDisplayWeight, formatWeight, parseDisplayWeightToKg } from '../engines/unitConversionEngine';
import { formatBlockType, formatSkippedReason, formatTechniqueQuality } from '../i18n/formatters';
import type { LoadFeedbackValue, RestTimerState, SupportSkipReason, TrainingSession, TrainingSetLog, UnitSettings, WeightUnit } from '../models/training-model';
import { MobileActionBar, StatusBadge } from '../ui/common';

type EditableSetField = 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality';
type FocusBlockType = 'main' | 'correction' | 'functional';

interface TrainingFocusViewProps {
  session: TrainingSession;
  unitSettings: UnitSettings;
  restTimer: RestTimerState | null;
  expandedExercise: number;
  setExpandedExercise: React.Dispatch<React.SetStateAction<number>>;
  onSetChange: (exerciseIndex: number, setIndex: number, field: EditableSetField, value: string | boolean) => void;
  onCompleteSet: (exerciseIndex: number, advanceExercise?: boolean) => void;
  onCopyPrevious: (exerciseIndex: number) => void;
  onAdjustSet: (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => void;
  onApplySuggestion: (exerciseIndex: number) => void;
  onUpdateActualDraft: (
    exerciseIndex: number,
    updates: { actualWeightKg?: number; displayWeight?: number; displayUnit?: WeightUnit; actualReps?: number; actualRir?: number; techniqueQuality?: TrainingSetLog['techniqueQuality']; painFlag?: boolean }
  ) => void;
  onSwitchExercise: (exerciseIndex: number) => void;
  onReplaceExercise: (exerciseIndex: number) => void;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish?: () => void;
  onFinishToCalendar?: () => void;
  onFinishToToday?: () => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onSkipSupportBlock: (blockType: 'correction' | 'functional', reason: SupportSkipReason) => void;
  onUpdateSupportSkipReason: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
}

const supportReasonOptions: Array<{ value: SupportSkipReason; label: string }> = [
  { value: 'time', label: formatSkippedReason('time') },
  { value: 'pain', label: formatSkippedReason('pain') },
  { value: 'equipment', label: formatSkippedReason('equipment') },
  { value: 'too_tired', label: formatSkippedReason('too_tired') },
  { value: 'forgot', label: formatSkippedReason('forgot') },
  { value: 'not_needed', label: formatSkippedReason('not_needed') },
  { value: 'other', label: formatSkippedReason('other') },
];

const qualityOptions: Array<{ value: NonNullable<TrainingSetLog['techniqueQuality']>; label: string }> = [
  { value: 'good', label: formatTechniqueQuality('good') },
  { value: 'acceptable', label: formatTechniqueQuality('acceptable') },
  { value: 'poor', label: formatTechniqueQuality('poor') },
];

const loadFeedbackOptions: Array<{ value: LoadFeedbackValue; label: string }> = [
  { value: 'too_light', label: '偏轻' },
  { value: 'good', label: '合适' },
  { value: 'too_heavy', label: '偏重' },
];

const getSets = (exercise: TrainingSession['exercises'][number]): TrainingSetLog[] => (Array.isArray(exercise.sets) ? exercise.sets : []);

const blockLabel = (blockType: FocusBlockType) => formatBlockType(blockType);

export function TrainingFocusView({
  session,
  unitSettings,
  restTimer,
  expandedExercise,
  setExpandedExercise,
  onSetChange,
  onCompleteSet,
  onCopyPrevious,
  onAdjustSet,
  onApplySuggestion,
  onUpdateActualDraft,
  onSwitchExercise,
  onReplaceExercise,
  onLoadFeedback,
  onFinish,
  onFinishToCalendar,
  onFinishToToday,
  onCompleteSupportSet,
  onSkipSupportExercise,
  onSkipSupportBlock,
  onUpdateSupportSkipReason,
}: TrainingFocusViewProps) {
  const [skipReason, setSkipReason] = React.useState<SupportSkipReason>('time');
  const [feedback, setFeedback] = React.useState('');
  const [showExercisePicker, setShowExercisePicker] = React.useState(false);
  const focusState = getFocusNavigationState(session, expandedExercise);
  const mainIndex = focusState.currentExerciseIndex;
  const mainExercise = focusState.currentExercise;
  const mainSets = mainExercise ? getSets(mainExercise) : [];
  const mainSetIndex = focusState.currentSetIndex;
  const mainSet = focusState.currentSet;
  const currentStep = focusState.currentStep;
  const actualDraft = focusState.actualDraft;
  const isSupportStep =
    currentStep.stepType === 'correction' || currentStep.stepType === 'functional' || currentStep.stepType === 'support';
  const sessionComplete = focusState.sessionComplete || Boolean(session.focusSessionComplete);
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const mainExercisePoolId = mainExercise?.canonicalExerciseId || mainExercise?.baseId || mainExercise?.id || '';
  const completedMainSets = mainSets.filter((set) => set.done).length;
  const existingLoadFeedback = mainExercisePoolId
    ? (session.loadFeedback || []).find((item) => item.exerciseId === mainExercisePoolId)
    : undefined;
  const warmupPolicyNotice =
    currentStep.stepType === 'working' && currentStep.warmupPolicy && !currentStep.warmupPolicy.shouldShowWarmupSets && currentStep.warmupPolicy.policy !== 'none'
      ? {
          id: `warmup-policy-${currentStep.exerciseId}`,
          type: 'warmup-policy',
          tone: 'info' as const,
          message: currentStep.warmupPolicy.reason || '已按热身策略直接进入正式组。',
        }
      : null;
  const notices = dedupeFocusNotices(
    [
      warmupPolicyNotice,
      mainExercise?.warning
        ? {
            id: `warning-${mainExercise.id}`,
            type: 'exercise-warning',
            tone: 'warning' as const,
            message: mainExercise.warning,
          }
        : null,
    ].filter(Boolean) as Parameters<typeof dedupeFocusNotices>[0],
    1
  );

  const [legacySupportModuleId, legacySupportExerciseId] = currentStep.stepType === 'support' ? currentStep.exerciseId.split('::') : ['', ''];
  const supportModuleId = currentStep.moduleId || legacySupportModuleId;
  const supportExerciseId = currentStep.moduleId ? currentStep.exerciseId : legacySupportExerciseId;
  const supportLog = isSupportStep
    ? (session.supportExerciseLogs || []).find((log) => log.moduleId === supportModuleId && log.exerciseId === supportExerciseId) || null
    : !mainExercise && !sessionComplete
      ? (session.supportExerciseLogs || []).find((log) => number(log.completedSets) < number(log.plannedSets))
      : null;
  const supportBlock =
    supportLog?.blockType === 'correction'
      ? session.correctionBlock?.find((block) => block.id === supportLog.moduleId)
      : supportLog?.blockType === 'functional'
        ? session.functionalBlock?.find((block) => block.id === supportLog.moduleId)
        : undefined;
  const supportExercise = supportBlock?.exercises.find((exercise) => exercise.exerciseId === supportLog?.exerciseId);
  const blockType: FocusBlockType = isSupportStep ? supportLog?.blockType || currentStep.blockType || 'functional' : mainExercise ? 'main' : supportLog?.blockType || 'main';
  const supportTimeSec = supportExercise && 'timeSec' in supportExercise ? supportExercise.timeSec : undefined;
  const supportDistanceM = supportExercise && 'distanceM' in supportExercise ? supportExercise.distanceM : undefined;
  const weightUnit = unitSettings.weightUnit;
  const stageLabel =
    currentStep.stepType === 'warmup'
      ? '热身组'
      : currentStep.stepType === 'working'
        ? '正式组'
        : currentStep.stepType === 'correction'
          ? '纠偏模块'
          : currentStep.stepType === 'functional'
            ? '功能补丁'
            : currentStep.stepType === 'support'
              ? '支持动作'
          : '完成';
  const plannedSummary =
    isSupportStep
      ? supportExercise
        ? `${supportExercise.name || supportLog?.exerciseName || '支持动作'} / ${supportExercise.sets || supportLog?.plannedSets || currentStep.totalSetsForStepType} 组${
            supportExercise.repMin || supportExercise.repMax ? ` / ${supportExercise.repMin || supportExercise.repMax}-${supportExercise.repMax || supportExercise.repMin} 次` : ''
          }${supportExercise.holdSec ? ` / 保持 ${supportExercise.holdSec} 秒` : ''}${supportTimeSec ? ` / ${supportTimeSec} 秒` : ''}${
            supportDistanceM ? ` / ${supportDistanceM} 米` : ''
          }`
        : '按支持动作计划完成'
      : `${formatWeight(currentStep.plannedWeight, unitSettings)} × ${number(currentStep.plannedReps)}${currentStep.plannedRir ? ` / RIR ${currentStep.plannedRir}` : ''}`;
  const actualWeight = actualDraft?.actualWeightKg;
  const actualReps = actualDraft?.actualReps;
  const actualDisplayWeight = actualWeight === undefined ? undefined : convertKgToDisplayWeight(actualWeight, weightUnit);
  const actualSummary = `${actualDisplayWeight === undefined ? '待输入' : `${actualDisplayWeight}${weightUnit}`} / ${actualReps === undefined ? '待输入' : `${number(actualReps)} 次`}`;
  const weightAdjustments = weightUnit === 'lb' ? [-20, -10, -5, 5, 10, 20] : [-10, -5, -2.5, 2.5, 5, 10];
  const repAdjustments = [-5, -1, 1, 5];

  const notify = (message: string) => setFeedback(message);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(''), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const switchExercise = (index: number) => {
    const exercise = session.exercises[index];
    if (!exercise) return;
    onSwitchExercise(index);
    setShowExercisePicker(false);
    notify(`已切换到 ${exercise.alias || exercise.name}`);
  };

  const copyPrevious = () => {
    if (mainIndex < 0 || mainSetIndex <= 0) {
      notify('暂无上一组可复制');
      return;
    }
    onCopyPrevious(mainIndex);
    notify('已复制上一组');
  };

  const togglePainFlag = () => {
    if (mainIndex < 0 || mainSetIndex < 0) return;
    const next = !mainSet?.painFlag;
    onUpdateActualDraft(mainIndex, { painFlag: next });
    notify(next ? '已标记不适' : '已取消不适标记');
  };

  const replaceExercise = () => {
    if (mainIndex < 0 || !mainExercise) return;
    if (!mainExercise.alternatives?.length && !mainExercise.originalName) {
      notify('当前动作暂无替代动作');
      return;
    }
    onReplaceExercise(mainIndex);
    notify('已切换替代动作');
  };

  const completeCurrentSet = () => {
    if (sessionComplete) {
      notify('训练已完成');
      return;
    }
    if (isSupportStep && supportLog) {
      onCompleteSupportSet(supportLog.moduleId, supportLog.exerciseId);
      notify('已完成支持动作');
      return;
    }
    if (mainIndex < 0 || mainSetIndex < 0) return;
    if (number(actualDraft?.actualWeightKg) <= 0 && number(actualDraft?.actualReps) <= 0) {
      notify('请先记录重量/次数，或点套用建议');
      return;
    }
    onCompleteSet(mainIndex);
    notify(currentStep.stepType === 'warmup' ? '已完成热身组' : '已完成正式组');
  };

  if (sessionComplete) {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-2xl flex-col gap-3 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
        <section className="rounded-lg border border-emerald-200 bg-white p-5 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-black text-slate-950">本次训练已完成</h2>
        <p className="mt-2 text-base leading-7 text-slate-600">不会再自动跳回第一个动作。保存后系统会把本次训练写入历史、日历和进度页。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-emerald-50 p-4">
            <div className="text-xs font-black text-emerald-700">完成组数</div>
            <div className="mt-1 text-2xl font-black text-emerald-950">
              {focusState.completedSets}/{focusState.totalSets}
            </div>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <div className="text-xs font-black text-slate-500">当前总量</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{Math.round(focusState.totalVolume)}kg</div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={onFinish} className="h-12 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white">
            查看本次训练
          </button>
          <button type="button" onClick={onFinishToCalendar || onFinish} className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
            查看训练日历
          </button>
          <button type="button" onClick={onFinishToToday || onFinish} className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
            返回首页
          </button>
        </div>
        </section>
        {showExercisePicker ? (
          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black text-slate-500">已完成动作</div>
            <div className="space-y-2">
              {session.exercises.map((exercise, index) => {
                const sets = getSets(exercise);
                const done = sets.filter((set) => set.done).length;
                return (
                  <div key={`${exercise.id}-completed-${index}`} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-3">
                    <span className="font-black text-slate-900">{exercise.alias || exercise.name}</span>
                    <span className="text-sm font-black text-slate-600">
                      {done}/{sets.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (currentStep.stepType === 'completed' && mainExercise) {
    return (
      <div className="mx-auto flex min-h-[72svh] max-w-2xl flex-col gap-3 pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
        <section className="rounded-lg border border-emerald-200 bg-white p-5 text-center">
          <CheckCircle className="mx-auto h-9 w-9 text-emerald-600" />
          <h2 className="mt-3 text-2xl font-black text-slate-950">{mainExercise.alias || mainExercise.name}</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">该动作已完成。切换到其他动作时会定位到该动作第一个未完成步骤。</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => switchExercise(Math.max(0, mainIndex - 1))} disabled={mainIndex <= 0} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-40">
              上一个
            </button>
            <button type="button" onClick={() => setShowExercisePicker((current) => !current)} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700">
              切换动作
            </button>
            <button type="button" onClick={() => switchExercise(Math.min(session.exercises.length - 1, mainIndex + 1))} disabled={mainIndex >= session.exercises.length - 1} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-40">
              下一个
            </button>
          </div>
        </section>
        {showExercisePicker ? (
          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black text-slate-500">选择动作</div>
            <div className="space-y-2">
              {session.exercises.map((exercise, index) => {
                const sets = getSets(exercise);
                const done = sets.filter((set) => set.done).length;
                return (
                  <button
                    key={`${exercise.id}-completed-picker-${index}`}
                    type="button"
                    onClick={() => switchExercise(index)}
                    className="flex w-full items-center justify-between rounded-lg bg-stone-50 px-3 py-3 text-left"
                  >
                    <span className="font-black text-slate-900">{exercise.alias || exercise.name}</span>
                    <span className="text-sm font-black text-slate-600">
                      {done}/{sets.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[72svh] max-w-2xl flex-col gap-3 pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={blockType === 'main' ? 'emerald' : blockType === 'correction' ? 'amber' : 'sky'}>{blockLabel(blockType)}</StatusBadge>
              <StatusBadge tone={currentStep.stepType === 'working' ? 'emerald' : 'slate'}>{stageLabel}</StatusBadge>
            </div>
            <h2 className="mt-1 text-3xl font-black leading-tight text-slate-950">{mainExercise?.alias || mainExercise?.name || supportLog?.exerciseName || supportExercise?.name}</h2>
            <div className="mt-2 text-sm font-bold text-slate-500">
              {currentStep.label}
            </div>
          </div>
          <div className={classNames('rounded-lg px-3 py-2 text-right', remainingSec > 0 ? 'bg-slate-950 text-white' : 'bg-stone-100 text-slate-700')}>
            <div className="flex items-center justify-end gap-1 text-xs font-bold opacity-75">
              <Timer className="h-3.5 w-3.5" />
              休息
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums">{formatTimer(remainingSec)}</div>
          </div>
        </div>
      </section>

      {mainExercise ? (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-500">建议</div>
              <div className="mt-2 text-xl font-black text-slate-950">{plannedSummary}</div>
              <button type="button" onClick={() => { onApplySuggestion(mainIndex); notify('已套用建议重量和次数'); }} className="mt-3 h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800">
                套用建议
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-500">实际记录</div>
              <div className="mt-2 text-xl font-black text-slate-950">{actualSummary}</div>
              <div className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{mainExercise.lastSummary || '暂无上次记录'}</div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black text-slate-500">快速调整重量（{weightUnit}）</div>
            <div className="grid grid-cols-3 gap-2">
              {weightAdjustments.map((delta) => (
                <button
                  key={`weight-${delta}`}
                  type="button"
                  aria-label={`重量${delta > 0 ? '增加' : '减少'} ${Math.abs(delta)}${weightUnit}`}
                  onClick={() => {
                    const nextDisplayWeight = Math.max(0, number(actualDisplayWeight) + delta);
                    onUpdateActualDraft(mainIndex, {
                      actualWeightKg: parseDisplayWeightToKg(nextDisplayWeight, weightUnit),
                      displayWeight: nextDisplayWeight,
                      displayUnit: weightUnit,
                    });
                    notify('已调整重量');
                  }}
                  className="h-12 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-black text-slate-500">
                自定义重量
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={weightUnit === 'lb' ? '1' : '0.5'}
                  value={actualDisplayWeight ?? ''}
                  onChange={(event) =>
                    onUpdateActualDraft(mainIndex, {
                      actualWeightKg: parseDisplayWeightToKg(event.target.value, weightUnit),
                      displayWeight: Math.max(0, number(event.target.value)),
                      displayUnit: weightUnit,
                    })
                  }
                  className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-black text-slate-900"
                  placeholder={`0${weightUnit}`}
                />
              </label>
              <label className="text-xs font-black text-slate-500">
                自定义次数
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={actualReps ?? ''}
                  onChange={(event) => onUpdateActualDraft(mainIndex, { actualReps: Math.max(0, Math.round(number(event.target.value))) })}
                  className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-black text-slate-900"
                  placeholder="0 次"
                />
              </label>
            </div>
            <div className="mt-3 text-xs font-black text-slate-500">快速调整次数</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {repAdjustments.map((delta) => (
                <button
                  key={`rep-${delta}`}
                  type="button"
                  aria-label={`次数${delta > 0 ? '增加' : '减少'} ${Math.abs(delta)} 次`}
                  onClick={() => {
                    onAdjustSet(mainIndex, 'reps', delta);
                    notify('已调整次数');
                  }}
                  className="h-12 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => switchExercise(Math.max(0, mainIndex - 1))} disabled={mainIndex <= 0} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-40">
              上一个
            </button>
            <button type="button" onClick={() => setShowExercisePicker((current) => !current)} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700">
              切换动作
            </button>
            <button type="button" onClick={() => switchExercise(Math.min(session.exercises.length - 1, mainIndex + 1))} disabled={mainIndex >= session.exercises.length - 1} className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-40">
              下一个
            </button>
          </section>

          {showExercisePicker ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-black text-slate-500">选择动作</div>
              <div className="space-y-2">
                {session.exercises.map((exercise, index) => {
                  const sets = getSets(exercise);
                  const done = sets.filter((set) => set.done).length;
                  const selected = index === mainIndex;
                  return (
                    <button
                      key={`${exercise.id}-picker-${index}`}
                      type="button"
                      onClick={() => switchExercise(index)}
                      className={classNames('flex w-full items-center justify-between rounded-lg px-3 py-3 text-left', selected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-stone-50')}
                    >
                      <span className="font-black text-slate-900">{exercise.alias || exercise.name}</span>
                      <span className="text-sm font-black text-slate-600">
                        {done}/{sets.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black text-slate-500">动作质量</div>
            <div className="grid grid-cols-3 gap-2">
              {qualityOptions.map((option) => {
                const selected = (actualDraft?.techniqueQuality || 'acceptable') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => mainSetIndex >= 0 && onUpdateActualDraft(mainIndex, { techniqueQuality: option.value })}
                    className={classNames(
                      'h-12 rounded-lg border text-sm font-black',
                      selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          {notices.map((notice) => (
            <div key={notice.id} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {notice.message}
            </div>
          ))}

          {feedback ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-900">{feedback}</div> : null}

          {currentStep.stepType === 'working' && completedMainSets > 0 && mainExercisePoolId ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-black text-slate-500">本次推荐重量感觉如何？</div>
              <div className="grid grid-cols-3 gap-2">
                {loadFeedbackOptions.map((option) => {
                  const selected = existingLoadFeedback?.feedback === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onLoadFeedback(mainExercisePoolId, option.value)}
                      className={classNames(
                        'h-11 rounded-lg border text-sm font-black',
                        selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <MobileActionBar className="!bottom-[calc(64px+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2 md:!bottom-auto">
            <button
              type="button"
              onClick={completeCurrentSet}
              disabled={mainSetIndex < 0}
              className="h-16 rounded-lg bg-emerald-600 text-lg font-black text-white disabled:bg-slate-300"
            >
              完成一组
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" aria-label="复制上一组" onClick={copyPrevious} disabled={mainSetIndex <= 0} className="grid h-16 place-items-center rounded-lg border border-slate-200 bg-white px-1 text-slate-700 disabled:opacity-40" title="复制上一组">
                <Copy className="h-4 w-4" />
                <span className="text-[11px] font-black">复制上组</span>
              </button>
              <button type="button" aria-label="标记不适" onClick={togglePainFlag} className={classNames('grid h-16 place-items-center rounded-lg border px-1 text-slate-700', actualDraft?.painFlag ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white')} title="标记不适">
                <span className="text-base font-black">!</span>
                <span className="text-[11px] font-black">标记不适</span>
              </button>
              <button type="button" aria-label="替代动作" onClick={replaceExercise} className="grid h-16 place-items-center rounded-lg border border-slate-200 bg-white px-1 text-slate-700" title="替代动作">
                <Replace className="h-4 w-4" />
                <span className="text-[11px] font-black">替代动作</span>
              </button>
            </div>
          </MobileActionBar>

          <details className="rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer list-none text-xs font-black text-slate-500">查看训练顺序与依据</summary>
            <div className="mt-3 space-y-2">
              {session.exercises.map((exercise, index) => {
                const sets = getSets(exercise);
                const done = sets.filter((set) => set.done).length;
                const selected = index === mainIndex;
                return (
                  <button
                    key={`${exercise.id}-${index}`}
                    type="button"
                    onClick={() => switchExercise(index)}
                    className={classNames('flex w-full items-center justify-between rounded-lg px-3 py-3 text-left', selected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-stone-50')}
                  >
                    <span className="font-black text-slate-900">{exercise.alias || exercise.name}</span>
                    <span className="text-sm font-black text-slate-600">
                      {done}/{sets.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs font-bold leading-5 text-slate-500">
              这里仅作训练中定位；e1RM 来源、证据规则和有效组细节留在完整训练页与进度页查看，避免训练时信息过载。
            </div>
          </details>
        </>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-black text-emerald-700">{stageLabel}</div>
          <h2 className="mt-1 text-3xl font-black leading-tight text-slate-950">{supportExercise?.name || supportLog?.exerciseName || currentStep.exerciseName || '支持动作'}</h2>
          <div className="mt-1 text-sm font-bold text-slate-500">{supportBlock?.name || currentStep.moduleName || '支持模块'}</div>
          <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm font-bold text-slate-700">{plannedSummary}</div>
          <div className="mt-2 text-2xl font-black text-slate-950">
            {supportLog?.completedSets || 0}/{supportLog?.plannedSets || 0} 组
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() => supportLog && onCompleteSupportSet(supportLog.moduleId, supportLog.exerciseId)}
              className="h-16 rounded-lg bg-emerald-600 text-lg font-black text-white"
            >
              完成一组
            </button>
            <button
              onClick={() => supportLog && onSkipSupportExercise(supportLog.moduleId, supportLog.exerciseId, skipReason)}
              className="h-16 rounded-lg border border-amber-200 bg-amber-50 px-4 font-black text-amber-900"
              title="跳过"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          {supportLog?.blockType === 'correction' || supportLog?.blockType === 'functional' ? (
            <button
              type="button"
              onClick={() => {
                const label = supportLog.blockType === 'correction' ? '纠偏模块' : '功能补丁';
                const confirmed = typeof window === 'undefined' ? true : window.confirm(`跳过整个${label}？未完成的支持动作会记录为跳过。`);
                if (!confirmed) return;
                onSkipSupportBlock(supportLog.blockType, skipReason);
                notify(`已跳过${label}`);
              }}
              className="mt-2 h-12 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900"
            >
              跳过整个{supportLog.blockType === 'correction' ? '纠偏模块' : '功能补丁'}
            </button>
          ) : null}
          <select
            value={skipReason}
            onChange={(event) => {
              const next = event.target.value as SupportSkipReason;
              setSkipReason(next);
              if (supportLog) onUpdateSupportSkipReason(supportLog.moduleId, supportLog.exerciseId, next);
            }}
            className="mt-3 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-bold text-slate-700"
          >
            {supportReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>
      )}
    </div>
  );
}
