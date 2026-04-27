import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Replace, SkipForward, Timer } from 'lucide-react';
import { classNames, formatTimer, number } from '../engines/engineUtils';
import { dedupeFocusNotices, getFocusNavigationState } from '../engines/focusModeStateEngine';
import { getRestTimerRemainingSec } from '../engines/restTimerEngine';
import { formatBlockType, formatSkippedReason, formatTechniqueQuality } from '../i18n/formatters';
import type { LoadFeedbackValue, RestTimerState, SupportSkipReason, TrainingSession, TrainingSetLog } from '../models/training-model';

type EditableSetField = 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality';
type FocusBlockType = 'main' | 'correction' | 'functional';

interface TrainingFocusViewProps {
  session: TrainingSession;
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
    updates: { actualWeightKg?: number; actualReps?: number; actualRir?: number; techniqueQuality?: TrainingSetLog['techniqueQuality']; painFlag?: boolean }
  ) => void;
  onSwitchExercise: (exerciseIndex: number) => void;
  onReplaceExercise: (exerciseIndex: number) => void;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish?: () => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
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
  onCompleteSupportSet,
  onSkipSupportExercise,
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
  const sessionComplete = focusState.sessionComplete || Boolean(session.focusSessionComplete);
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const mainExercisePoolId = mainExercise?.canonicalExerciseId || mainExercise?.baseId || mainExercise?.id || '';
  const completedMainSets = mainSets.filter((set) => set.done).length;
  const existingLoadFeedback = mainExercisePoolId
    ? (session.loadFeedback || []).find((item) => item.exerciseId === mainExercisePoolId)
    : undefined;
  const notices = dedupeFocusNotices(
    [
      mainExercise?.warning
        ? {
            id: `warning-${mainExercise.id}`,
            type: 'exercise-warning',
            tone: 'warning' as const,
            message: mainExercise.warning,
          }
        : null,
    ].filter(Boolean) as Parameters<typeof dedupeFocusNotices>[0],
    3
  );

  const [supportModuleId, supportExerciseId] = currentStep.stepType === 'support' ? currentStep.exerciseId.split('::') : ['', ''];
  const supportLog = currentStep.stepType === 'support'
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
  const blockType: FocusBlockType = currentStep.stepType === 'support' ? supportLog?.blockType || 'functional' : mainExercise ? 'main' : supportLog?.blockType || 'main';
  const stageLabel =
    currentStep.stepType === 'warmup'
      ? '热身组'
      : currentStep.stepType === 'working'
        ? '正式组'
        : currentStep.stepType === 'support'
          ? '支持动作'
          : '完成';
  const plannedSummary =
    currentStep.stepType === 'support'
      ? supportExercise
        ? `${supportExercise.name || supportLog?.exerciseName || '支持动作'} / ${supportExercise.sets || supportLog?.plannedSets || currentStep.totalSetsForStepType} 组`
        : '按支持动作计划完成'
      : `${number(currentStep.plannedWeight)}kg × ${number(currentStep.plannedReps)}${currentStep.plannedRir ? ` / RIR ${currentStep.plannedRir}` : ''}`;
  const actualWeight = actualDraft?.actualWeightKg;
  const actualReps = actualDraft?.actualReps;
  const actualSummary = `${actualWeight === undefined ? '待输入' : `${number(actualWeight)}kg`} / ${actualReps === undefined ? '待输入' : `${number(actualReps)} 次`}`;

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
    if (currentStep.stepType === 'support' && supportLog) {
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
        <p className="mt-2 text-base leading-7 text-slate-600">不会再自动跳回第一个动作。保存后系统会把本次训练写入历史和进度页。</p>
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
            保存并结束训练
          </button>
          <button type="button" onClick={onFinish} className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
            查看训练总结
          </button>
          <button type="button" onClick={() => setShowExercisePicker((current) => !current)} className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
            返回查看动作
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

  return (
    <div className="mx-auto flex min-h-[72svh] max-w-2xl flex-col gap-3 pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-emerald-700">{blockLabel(blockType)} / {stageLabel}</div>
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

          <section className="grid grid-cols-4 gap-2">
            <button type="button" aria-label="重量减少 2.5kg" onClick={() => { onAdjustSet(mainIndex, 'weight', -2.5); notify('已调整重量'); }} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              -2.5
            </button>
            <button type="button" aria-label="重量增加 2.5kg" onClick={() => { onAdjustSet(mainIndex, 'weight', 2.5); notify('已调整重量'); }} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              +2.5
            </button>
            <button type="button" aria-label="次数减少 1 次" onClick={() => { onAdjustSet(mainIndex, 'reps', -1); notify('已调整次数'); }} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              -1
            </button>
            <button type="button" aria-label="次数增加 1 次" onClick={() => { onAdjustSet(mainIndex, 'reps', 1); notify('已调整次数'); }} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              +1
            </button>
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

          <section className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
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
          </section>

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
          <div className="text-xs font-black text-slate-500">辅助动作完成记录</div>
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
