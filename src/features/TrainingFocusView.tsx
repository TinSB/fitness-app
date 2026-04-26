import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Replace, SkipForward, Timer } from 'lucide-react';
import { getRestTimerRemainingSec, classNames, formatTimer, number } from '../engines/trainingEngine';
import type { RestTimerState, SupportSkipReason, TrainingSession, TrainingSetLog } from '../models/training-model';

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
  onReplaceExercise: (exerciseIndex: number) => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onUpdateSupportSkipReason: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
}

const supportReasonOptions: Array<{ value: SupportSkipReason; label: string }> = [
  { value: 'time', label: '时间不够' },
  { value: 'pain', label: '不适' },
  { value: 'equipment', label: '器械问题' },
  { value: 'too_tired', label: '太累了' },
  { value: 'forgot', label: '忘记了' },
  { value: 'not_needed', label: '今天不需要' },
  { value: 'other', label: '其他' },
];

const qualityOptions: Array<{ value: NonNullable<TrainingSetLog['techniqueQuality']>; label: string }> = [
  { value: 'good', label: '良好' },
  { value: 'acceptable', label: '可接受' },
  { value: 'poor', label: '较差' },
];

const getSets = (exercise: TrainingSession['exercises'][number]): TrainingSetLog[] => (Array.isArray(exercise.sets) ? exercise.sets : []);

const nextMainIndex = (session: TrainingSession, preferredIndex: number) => {
  const preferred = session.exercises[preferredIndex];
  if (preferred && getSets(preferred).some((set) => !set.done)) return preferredIndex;
  const next = session.exercises.findIndex((exercise) => getSets(exercise).some((set) => !set.done));
  return next >= 0 ? next : -1;
};

const blockLabel: Record<FocusBlockType, string> = {
  main: '主训练',
  correction: '纠偏',
  functional: '功能补丁',
};

export function TrainingFocusView({
  session,
  restTimer,
  expandedExercise,
  setExpandedExercise,
  onSetChange,
  onCompleteSet,
  onCopyPrevious,
  onAdjustSet,
  onReplaceExercise,
  onCompleteSupportSet,
  onSkipSupportExercise,
  onUpdateSupportSkipReason,
}: TrainingFocusViewProps) {
  const [skipReason, setSkipReason] = React.useState<SupportSkipReason>('time');
  const mainIndex = nextMainIndex(session, expandedExercise);
  const mainExercise = mainIndex >= 0 ? session.exercises[mainIndex] : null;
  const mainSets = mainExercise ? getSets(mainExercise) : [];
  const mainSetIndex = mainSets.findIndex((set) => !set.done);
  const mainSet = mainSetIndex >= 0 ? mainSets[mainSetIndex] : mainSets[mainSets.length - 1];
  const remainingSec = getRestTimerRemainingSec(restTimer);

  const supportLog = !mainExercise
    ? (session.supportExerciseLogs || []).find((log) => number(log.completedSets) < number(log.plannedSets))
    : null;
  const supportBlock =
    supportLog?.blockType === 'correction'
      ? session.correctionBlock?.find((block) => block.id === supportLog.moduleId)
      : supportLog?.blockType === 'functional'
        ? session.functionalBlock?.find((block) => block.id === supportLog.moduleId)
        : undefined;
  const supportExercise = supportBlock?.exercises.find((exercise) => exercise.exerciseId === supportLog?.exerciseId);
  const blockType: FocusBlockType = mainExercise ? 'main' : supportLog?.blockType || 'main';

  if (!mainExercise && !supportLog) {
    return (
      <div className="min-h-[70svh] rounded-lg border border-emerald-200 bg-white p-5 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-black text-slate-950">今天的训练内容已完成</h2>
        <p className="mt-2 text-base leading-7 text-slate-600">可以保存并结束训练。系统会根据完成度、动作质量和跳过原因调整下一次安排。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[72svh] max-w-2xl flex-col gap-3 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-emerald-700">{blockLabel[blockType]}</div>
            <h2 className="mt-1 text-3xl font-black leading-tight text-slate-950">{mainExercise?.alias || mainExercise?.name || supportLog?.exerciseName || supportExercise?.name}</h2>
            <div className="mt-2 text-sm font-bold text-slate-500">
              {mainExercise
                ? `第 ${mainSetIndex + 1} / ${mainSets.length} 组`
                : `第 ${number(supportLog?.completedSets) + 1} / ${number(supportLog?.plannedSets)} 组`}
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
              <div className="text-xs font-bold text-slate-500">今日目标</div>
              <div className="mt-2 text-2xl font-black text-slate-950">{number(mainSet?.weight)}kg</div>
              <div className="mt-1 text-base font-bold text-slate-700">
                {mainExercise.repMin}-{mainExercise.repMax} 次 / {mainExercise.targetRirText || 'RIR 1-2'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-500">上次记录</div>
              <div className="mt-2 text-base font-black leading-6 text-slate-950">{mainExercise.lastSummary || '暂无记录'}</div>
              <div className="mt-1 text-sm font-bold text-emerald-700">{mainExercise.suggestion || '维持推进'}</div>
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2">
            <button onClick={() => onAdjustSet(mainIndex, 'weight', -2.5)} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              -2.5
            </button>
            <button onClick={() => onAdjustSet(mainIndex, 'weight', 2.5)} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              +2.5
            </button>
            <button onClick={() => onAdjustSet(mainIndex, 'reps', -1)} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              -1
            </button>
            <button onClick={() => onAdjustSet(mainIndex, 'reps', 1)} className="h-14 rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700">
              +1
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black text-slate-500">动作质量</div>
            <div className="grid grid-cols-3 gap-2">
              {qualityOptions.map((option) => {
                const selected = (mainSet?.techniqueQuality || 'acceptable') === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => mainSetIndex >= 0 && onSetChange(mainIndex, mainSetIndex, 'techniqueQuality', option.value)}
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

          {mainExercise.warning ? (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {mainExercise.warning}
            </div>
          ) : null}

          <section className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
            <button
              onClick={() => onCompleteSet(mainIndex, true)}
              disabled={mainSetIndex < 0 || !number(mainSet?.weight) || !number(mainSet?.reps)}
              className="h-16 rounded-lg bg-emerald-600 text-lg font-black text-white disabled:bg-slate-300"
            >
              完成一组
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onCopyPrevious(mainIndex)} disabled={mainSetIndex <= 0} className="grid h-16 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40" title="复制上一组">
                <Copy className="h-5 w-5" />
              </button>
              <button onClick={() => mainSetIndex >= 0 && onSetChange(mainIndex, mainSetIndex, 'painFlag', !mainSet?.painFlag)} className={classNames('grid h-16 place-items-center rounded-lg border text-slate-700', mainSet?.painFlag ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white')} title="标记疼痛">
                !
              </button>
              <button onClick={() => onReplaceExercise(mainIndex)} className="grid h-16 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700" title="替代动作">
                <Replace className="h-5 w-5" />
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black text-slate-500">训练顺序</div>
            <div className="space-y-2">
              {session.exercises.map((exercise, index) => {
                const sets = getSets(exercise);
                const done = sets.filter((set) => set.done).length;
                const selected = index === mainIndex;
                return (
                  <button
                    key={`${exercise.id}-${index}`}
                    onClick={() => setExpandedExercise(index)}
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
        </>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-black text-slate-500">Support 完成记录</div>
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
