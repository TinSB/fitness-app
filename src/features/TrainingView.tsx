import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Timer } from 'lucide-react';
import { DEFAULT_STATUS } from '../data/trainingData';
import { buildExerciseLearningPath, buildSessionExplanations, classNames, formatTimer, getRestTimerRemainingSec, number, resolveMode, sessionVolume } from '../engines/trainingEngine';
import { formatSkippedReason, formatTechniqueQuality } from '../i18n/formatters';
import type {
  CorrectionModule,
  ExercisePrescription,
  FunctionalAddon,
  LoadFeedbackValue,
  RestTimerState,
  SupportSkipReason,
  TrainingSession,
  TrainingSetLog,
} from '../models/training-model';
import { TrainingFocusView } from './TrainingFocusView';
import { Page, Stat, SupportBlockList } from '../ui/common';

type LoggedExercise = ExercisePrescription & {
  increment?: number;
};

interface TrainingViewProps {
  session: TrainingSession | null;
  restTimer: RestTimerState | null;
  expandedExercise: number;
  setExpandedExercise: React.Dispatch<React.SetStateAction<number>>;
  onStartFromSelected: () => void;
  onSetChange: (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality',
    value: string | boolean
  ) => void;
  onCompleteSet: (exerciseIndex: number, advanceExercise?: boolean) => void;
  onCopyPrevious: (exerciseIndex: number) => void;
  onAdjustSet: (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onUpdateSupportSkipReason: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onReplaceExercise: (exerciseIndex: number) => void;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish: () => void;
  onDelete: () => void;
  onExtendRestTimer: (seconds: number) => void;
  onToggleRestTimer: () => void;
  onClearRestTimer: () => void;
  onGoToday: () => void;
}

const getSets = (exercise: LoggedExercise): TrainingSetLog[] => (Array.isArray(exercise.sets) ? exercise.sets : []);

const templateNameLabels: Record<string, string> = {
  'push-a': '推 A',
  'pull-a': '拉 A',
  'legs-a': '腿 A',
  upper: '上肢',
  lower: '下肢',
  arms: '手臂 + 三角',
  'quick-30': '快练 30',
  'crowded-gym': '人多替代',
};

const supportReasonOptions: Array<{ value: SupportSkipReason; label: string }> = [
  { value: 'time', label: formatSkippedReason('time') },
  { value: 'pain', label: formatSkippedReason('pain') },
  { value: 'equipment', label: formatSkippedReason('equipment') },
  { value: 'too_tired', label: formatSkippedReason('too_tired') },
  { value: 'forgot', label: formatSkippedReason('forgot') },
  { value: 'not_needed', label: formatSkippedReason('not_needed') },
  { value: 'other', label: formatSkippedReason('other') },
];

const techniqueOptions: Array<{ value: NonNullable<TrainingSetLog['techniqueQuality']>; label: string }> = [
  { value: 'good', label: formatTechniqueQuality('good') },
  { value: 'acceptable', label: formatTechniqueQuality('acceptable') },
  { value: 'poor', label: formatTechniqueQuality('poor') },
];

const templateLabel = (id: string, fallback: string) => templateNameLabels[id] || fallback;

const findNextUnfinishedSetIndex = (exercise: LoggedExercise) => getSets(exercise).findIndex((set) => !set.done);

const findFocusExerciseIndex = (session: TrainingSession, expandedExercise: number) => {
  const expanded = session.exercises[expandedExercise] as LoggedExercise | undefined;
  if (expanded && findNextUnfinishedSetIndex(expanded) >= 0) return expandedExercise;
  const nextUnfinished = session.exercises.findIndex((exercise) => findNextUnfinishedSetIndex(exercise as LoggedExercise) >= 0);
  return nextUnfinished >= 0 ? nextUnfinished : 0;
};

const supportLogKey = (moduleId: string, exerciseId: string) => `${moduleId}:${exerciseId}`;

const renderTechniqueButtons = (
  value: NonNullable<TrainingSetLog['techniqueQuality']>,
  onChange: (next: NonNullable<TrainingSetLog['techniqueQuality']>) => void
) => (
  <div className="grid grid-cols-3 gap-2">
    {techniqueOptions.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={classNames(
            'rounded-lg border px-3 py-2 text-sm font-black transition',
            selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export function TrainingView({
  session,
  restTimer,
  expandedExercise,
  setExpandedExercise,
  onStartFromSelected,
  onSetChange,
  onCompleteSet,
  onCopyPrevious,
  onAdjustSet,
  onCompleteSupportSet,
  onSkipSupportExercise,
  onUpdateSupportSkipReason,
  onReplaceExercise,
  onLoadFeedback,
  onFinish,
  onDelete,
  onExtendRestTimer,
  onToggleRestTimer,
  onClearRestTimer,
  onGoToday,
}: TrainingViewProps) {
  const [supportReasonDrafts, setSupportReasonDrafts] = React.useState<Record<string, SupportSkipReason>>({});
  const [focusMode, setFocusMode] = React.useState(false);

  React.useEffect(() => {
    setSupportReasonDrafts({});
    const prefersFocus = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    setFocusMode(prefersFocus);
  }, [session?.id]);

  if (!session) {
    return (
      <Page eyebrow="训练" title="训练工作台">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-stone-100 text-slate-400">
            <Timer className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950">当前没有进行中的训练</h2>
          <p className="mt-2 text-sm text-slate-500">从今日页开始一场训练，记录会进入历史，周预算也会一起更新。</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button onClick={onStartFromSelected} className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white">
              用当前模板开练
            </button>
            <button onClick={onGoToday} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
              回到今日
            </button>
          </div>
        </div>
      </Page>
    );
  }

  const totalSets = session.exercises.reduce((sum, exercise) => sum + getSets(exercise as LoggedExercise).length, 0);
  const doneSets = session.exercises.reduce((sum, exercise) => sum + getSets(exercise as LoggedExercise).filter((set) => set.done).length, 0);
  const currentVolume = sessionVolume(session);
  const notes = session.exercises.flatMap((exercise) =>
    getSets(exercise as LoggedExercise)
      .filter((set) => set.note)
      .map((set) => ({
        key: `${exercise.id}-${set.id}-note`,
        exercise: exercise.alias || exercise.name,
        note: set.note || '',
      }))
  );
  const explanations = buildSessionExplanations(session);
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const focusExerciseIndex = findFocusExerciseIndex(session, expandedExercise);
  const focusExercise = session.exercises[focusExerciseIndex] as LoggedExercise;
  const focusSets = focusExercise ? getSets(focusExercise) : [];
  const focusSetIndex = focusExercise ? findNextUnfinishedSetIndex(focusExercise) : -1;
  const currentSet = focusSetIndex >= 0 ? focusSets[focusSetIndex] : focusSets[focusSets.length - 1];
  const allMainDone = session.exercises.every((exercise) => findNextUnfinishedSetIndex(exercise as LoggedExercise) === -1);

  const getSupportLog = (moduleId: string, exerciseId: string) =>
    (session.supportExerciseLogs || []).find((item) => item.moduleId === moduleId && item.exerciseId === exerciseId);

  const renderSupportTracker = (title: string, items: Array<CorrectionModule | FunctionalAddon>, compact = false) => {
    if (!items.length) return null;

    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">辅助动作需要单独记录，系统不会默认算作全部完成。</p>
        </div>
        <div className="space-y-3">
          {items.map((block) => (
            <div key={block.id} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-black text-slate-950">{block.name}</div>
                <div className="text-xs font-bold text-slate-500">{block.durationMin} 分钟</div>
              </div>
              <div className="space-y-2">
                {block.exercises.map((exercise) => {
                  const log = getSupportLog(block.id, exercise.exerciseId);
                  const draftKey = supportLogKey(block.id, exercise.exerciseId);
                  const reason = supportReasonDrafts[draftKey] || log?.skippedReason || 'too_tired';

                  return (
                    <div key={`${block.id}-${exercise.exerciseId}`} className="rounded-md bg-white p-3">
                      <div className={classNames('gap-2', compact ? 'grid grid-cols-1' : 'flex flex-col md:flex-row md:items-center md:justify-between')}>
                        <div>
                          <div className="font-black text-slate-900">{exercise.name || exercise.exerciseId}</div>
                          <div className="text-xs font-bold text-slate-500">
                            计划 {log?.plannedSets || exercise.sets} 组 / 已做 {log?.completedSets || 0} 组
                          </div>
                        </div>
                        <div className={classNames('gap-2', compact ? 'grid grid-cols-1 sm:grid-cols-[auto_1fr_auto]' : 'grid md:grid-cols-[auto_160px_auto]')}>
                          <button
                            onClick={() => onCompleteSupportSet(block.id, exercise.exerciseId)}
                            disabled={number(log?.completedSets) >= number(log?.plannedSets)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:bg-slate-300"
                          >
                            完成一组
                          </button>
                          <select
                            value={reason}
                            onChange={(event) => {
                              const nextReason = event.target.value as SupportSkipReason;
                              setSupportReasonDrafts((current) => ({ ...current, [draftKey]: nextReason }));
                              onUpdateSupportSkipReason(block.id, exercise.exerciseId, nextReason);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
                          >
                            {supportReasonOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => onSkipSupportExercise(block.id, exercise.exerciseId, reason)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900"
                          >
                            跳过
                          </button>
                        </div>
                      </div>
                      {log?.skippedReason && number(log.completedSets) < number(log.plannedSets) ? (
                        <div className="mt-2 text-xs font-bold text-amber-700">
                        跳过原因：{formatSkippedReason(log.skippedReason)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderExerciseFullCard = (rawExercise: TrainingSession['exercises'][number], exerciseIndex: number) => {
    const exercise = rawExercise as LoggedExercise;
    const sets = getSets(exercise);
    const done = sets.filter((set) => set.done).length;
    const nextSetIndex = findNextUnfinishedSetIndex(exercise);
    const active = expandedExercise === exerciseIndex;
    const allDone = nextSetIndex === -1;
    const rowSet = sets[nextSetIndex] || sets[sets.length - 1];
    const increment = typeof exercise.increment === 'number' ? exercise.increment : 2.5;
    const learningPath = buildExerciseLearningPath(exercise);

    return (
      <div key={`${exercise.id}-${exerciseIndex}`} className="rounded-lg border border-slate-200 bg-white">
        <button onClick={() => setExpandedExercise(active ? -1 : exerciseIndex)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-black text-slate-950">{exercise.alias || exercise.name}</h2>
              {exercise.autoReplaced ? <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">自动替代</span> : null}
              {allDone ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              上次 {exercise.lastSummary || '暂无'} / 今天 {exercise.targetSummary || exercise.suggestion || '按处方完成'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-black text-slate-950">
              {done}/{sets.length}
            </div>
            <div className="text-xs text-slate-500">已完成</div>
          </div>
        </button>

        {active ? (
          <div className="border-t border-slate-100 p-4">
            <div className="mb-4 grid gap-2 md:grid-cols-3">
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-bold text-slate-500">本次建议</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{exercise.suggestion || '按计划完成本动作'}</div>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-bold text-slate-500">休息</div>
                <div className="mt-1 text-sm font-bold text-slate-950">
                  {Math.round(exercise.rest / 60)} 分{exercise.rest % 60 ? ` ${exercise.rest % 60} 秒` : ''}
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-bold text-slate-500">目标强度</div>
                <div className="mt-1 text-sm font-bold text-slate-950">
                  {exercise.targetRirText || 'RIR 1-2'} / {exercise.recommendedLoadRange || '按建议负荷'}
                </div>
              </div>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs font-black text-slate-500">热身 / 爬坡组</div>
                <div className="mt-1 font-bold text-slate-800">
                  {exercise.warmupSets?.length ? exercise.warmupSets.map((set) => `${set.label || `${set.weight}kg`} x ${set.reps}`).join(' / ') : '轻重量 1-2 组后进入正式组'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs font-black text-slate-500">技术标准</div>
                <div className="mt-1 font-bold text-slate-800">
                  {exercise.techniqueStandard?.rom || '标准 ROM'} / 节奏 {exercise.techniqueStandard?.tempo || '2-0-1'} / {exercise.techniqueStandard?.stopRule || '动作变形即停'}
                </div>
              </div>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs font-black text-slate-500">处方规则</div>
                <div className="mt-1 font-bold text-slate-800">{exercise.prescription?.rule || '按当前模式推进'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="text-xs font-black text-slate-500">推进条件</div>
                <div className="mt-1 font-bold text-slate-800">连续两次打满上限，且 RIR 不低于 {exercise.targetRir?.[0] ?? 1}</div>
              </div>
              <button onClick={() => onReplaceExercise(exerciseIndex)} className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm font-black text-slate-700">
                替代动作
                <div className="mt-1 text-xs font-medium text-slate-500">{exercise.equivalence?.label || '当前模式链'} / {exercise.alternatives?.join(' / ') || '暂无'}</div>
              </button>
            </div>

            {learningPath ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">动作学习路径</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                  {learningPath.steps.map((step, index) => (
                    <React.Fragment key={`${learningPath.currentId}-${step.id}-${index}`}>
                      <span
                        className={classNames(
                          'rounded-md px-2 py-1',
                          step.stage === 'current' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                        )}
                      >
                        {step.name}
                      </span>
                      {index < learningPath.steps.length - 1 ? <span className="text-slate-400">→</span> : null}
                    </React.Fragment>
                  ))}
                </div>
                {learningPath.nextStepName ? <div className="mt-2 text-xs font-bold text-slate-500">下一步可尝试：{learningPath.nextStepName}</div> : null}
              </div>
            ) : null}

            {exercise.warning ? (
              <div className="mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {exercise.warning}
              </div>
            ) : null}

            <div className="mb-4 overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr_120px_150px_1.2fr] gap-2 text-xs font-black text-slate-500">
                  <div>组</div>
                  <div>重量</div>
                  <div>次数</div>
                  <div>RPE</div>
                  <div>RIR</div>
                  <div>疼痛标记</div>
                  <div>动作质量</div>
                  <div>备注</div>
                </div>
                <div className="mt-2 space-y-2">
                  {sets.map((set, setIndex) => (
                    <div
                      key={set.id}
                      className={classNames(
                        'grid grid-cols-[56px_1fr_1fr_1fr_1fr_120px_150px_1.2fr] gap-2 rounded-md',
                        set.done && 'opacity-70',
                        setIndex === nextSetIndex && 'bg-emerald-50 p-1 ring-2 ring-emerald-200'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => !set.done && setIndex === nextSetIndex && onCompleteSet(exerciseIndex)}
                        disabled={set.done || setIndex !== nextSetIndex || !number(set.weight) || !number(set.reps)}
                        className="flex h-10 items-center gap-2 rounded-md bg-slate-100 px-2 text-sm font-black disabled:cursor-default"
                      >
                        {set.done ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : setIndex + 1}
                      </button>
                      <input
                        type="number"
                        value={set.weight}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'weight', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'reps', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
                      />
                      <input
                        value={String(set.rpe ?? '')}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'rpe', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        placeholder="8"
                      />
                      <input
                        value={String(set.rir ?? '')}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'rir', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        placeholder={exercise.targetRirText || '1-2'}
                      />
                      <label className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-700">
                        <input type="checkbox" checked={Boolean(set.painFlag)} onChange={(event) => onSetChange(exerciseIndex, setIndex, 'painFlag', event.target.checked)} />
                        疼痛
                      </label>
                      <select
                        value={set.techniqueQuality || 'acceptable'}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'techniqueQuality', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500"
                      >
                        {techniqueOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={set.note || ''}
                        onChange={(event) => onSetChange(exerciseIndex, setIndex, 'note', event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        placeholder="肩不舒服 / 节奏乱了 / 器械被占"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.5fr_1.5fr]">
              <button
                onClick={() => onAdjustSet(exerciseIndex, 'weight', -increment)}
                disabled={allDone}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                -{increment}kg
              </button>
              <button
                onClick={() => onAdjustSet(exerciseIndex, 'weight', increment)}
                disabled={allDone}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                +{increment}kg
              </button>
              <button
                onClick={() => onAdjustSet(exerciseIndex, 'reps', -1)}
                disabled={allDone}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                -1 次
              </button>
              <button
                onClick={() => onAdjustSet(exerciseIndex, 'reps', 1)}
                disabled={allDone}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                +1 次
              </button>
              <button
                onClick={() => onCopyPrevious(exerciseIndex)}
                disabled={allDone || nextSetIndex <= 0}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                <Copy className="h-4 w-4" />
                复制上一组
              </button>
              <button
                onClick={() => onCompleteSet(exerciseIndex)}
                disabled={allDone || !number(rowSet?.weight) || !number(rowSet?.reps)}
                className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                {allDone ? '动作已完成' : `完成第 ${nextSetIndex + 1} 组`}
              </button>
              <button
                onClick={() => onCompleteSet(exerciseIndex, true)}
                disabled={allDone || !number(rowSet?.weight) || !number(rowSet?.reps)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
              >
                完成并切下一动作
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFocusMode = () => {
    if (!focusExercise) {
      return (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-xl font-black text-slate-950">主训练已经完成</h2>
          <p className="mt-2 text-sm text-slate-500">现在可以补纠偏、功能补丁，或者直接结束训练。</p>
        </section>
      );
    }

    const learningPath = buildExerciseLearningPath(focusExercise);
    const increment = typeof focusExercise.increment === 'number' ? focusExercise.increment : 2.5;
    const completedCount = focusSets.filter((set) => set.done).length;

    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-emerald-200 bg-white p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">极简训练模式</div>
              <h2 className="mt-1 text-3xl font-black text-slate-950">{focusExercise.alias || focusExercise.name}</h2>
              <div className="mt-2 text-sm font-bold text-slate-500">
                第 {Math.min(focusSetIndex + 1, focusSets.length)} / {focusSets.length} 组
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 px-4 py-3 text-right">
              <div className="text-xs font-bold text-slate-500">上次</div>
              <div className="text-sm font-black text-slate-900">{focusExercise.lastSummary || '暂无记录'}</div>
              <div className="mt-2 text-xs font-bold text-slate-500">今日策略</div>
              <div className="text-sm font-black text-emerald-700">{focusExercise.suggestion || '维持推进'}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs font-bold text-slate-500">目标重量</div>
              <div className="mt-1 text-3xl font-black text-slate-950">{number(currentSet?.weight)}kg</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => onAdjustSet(focusExerciseIndex, 'weight', -increment)} disabled={focusSetIndex < 0} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                  -{increment}
                </button>
                <button onClick={() => onAdjustSet(focusExerciseIndex, 'weight', increment)} disabled={focusSetIndex < 0} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                  +{increment}
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs font-bold text-slate-500">目标次数</div>
              <div className="mt-1 text-3xl font-black text-slate-950">
                {focusExercise.repMin}-{focusExercise.repMax}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => onAdjustSet(focusExerciseIndex, 'reps', -1)} disabled={focusSetIndex < 0} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                  -1
                </button>
                <button onClick={() => onAdjustSet(focusExerciseIndex, 'reps', 1)} disabled={focusSetIndex < 0} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                  +1
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs font-bold text-slate-500">当前状态</div>
              <div className="mt-1 text-3xl font-black text-slate-950">
                {completedCount}/{focusSets.length}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-600">{focusExercise.targetRirText || 'RIR 1-2'} / {focusExercise.recommendedLoadRange || '按建议负荷'}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-black text-slate-500">疼痛标记</div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(currentSet?.painFlag)}
                  onChange={(event) => focusSetIndex >= 0 && onSetChange(focusExerciseIndex, focusSetIndex, 'painFlag', event.target.checked)}
                />
                这组有不适
              </div>
            </label>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-black text-slate-500">动作质量</div>
              {renderTechniqueButtons((currentSet?.techniqueQuality || 'acceptable') as NonNullable<TrainingSetLog['techniqueQuality']>, (next) => {
                if (focusSetIndex >= 0) onSetChange(focusExerciseIndex, focusSetIndex, 'techniqueQuality', next);
              })}
            </div>
          </div>

          {learningPath ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-stone-50 p-3">
              <div className="text-xs font-black text-slate-500">动作学习路径</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                {learningPath.steps.map((step, index) => (
                  <React.Fragment key={`${learningPath.currentId}-focus-${step.id}-${index}`}>
                    <span className={classNames('rounded-md px-2 py-1', step.stage === 'current' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700')}>
                      {step.name}
                    </span>
                    {index < learningPath.steps.length - 1 ? <span className="text-slate-400">→</span> : null}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}

          {focusExercise.warning ? (
            <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {focusExercise.warning}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <button
              onClick={() => onCompleteSet(focusExerciseIndex)}
              disabled={focusSetIndex < 0 || !number(currentSet?.weight) || !number(currentSet?.reps)}
              className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              完成一组
            </button>
            <button
              onClick={() => onCopyPrevious(focusExerciseIndex)}
              disabled={focusSetIndex <= 0}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              复制上一组
            </button>
            <button
              onClick={() => onReplaceExercise(focusExerciseIndex)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
            >
              替代动作
            </button>
            <button
              onClick={() => onCompleteSet(focusExerciseIndex, true)}
              disabled={focusSetIndex < 0 || !number(currentSet?.weight) || !number(currentSet?.reps)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              完成并切下一动作
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-black text-slate-950">训练顺序</h2>
            <div className="text-xs font-bold text-slate-500">只高亮当前动作</div>
          </div>
          <div className="space-y-2">
            {session.exercises.map((exercise, index) => {
              const setCount = getSets(exercise as LoggedExercise);
              const doneCount = setCount.filter((set) => set.done).length;
              const isCurrent = index === focusExerciseIndex;
              return (
                <button
                  key={`${exercise.id}-focus-list-${index}`}
                  onClick={() => setExpandedExercise(index)}
                  className={classNames(
                    'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left',
                    isCurrent ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-stone-50'
                  )}
                >
                  <div>
                    <div className="font-black text-slate-900">{(exercise as LoggedExercise).alias || exercise.name}</div>
                    <div className="text-xs font-bold text-slate-500">{(exercise as LoggedExercise).targetSummary || (exercise as LoggedExercise).lastSummary}</div>
                  </div>
                  <div className="text-sm font-black text-slate-700">
                    {doneCount}/{setCount.length}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {renderSupportTracker('纠偏完成记录', session.correctionBlock || [], true)}
        {renderSupportTracker('功能补丁完成记录', session.functionalBlock || [], true)}
      </div>
    );
  };

  return (
    <Page
      eyebrow="训练"
      title={templateLabel(session.templateId, session.templateName)}
      action={
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFocusMode((current) => !current)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            {focusMode ? '退出极简模式' : '训练中极简模式'}
          </button>
          <button onClick={onDelete} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-700">
            放弃
          </button>
          <button onClick={onFinish} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">
            完成训练
          </button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="完成组数" value={`${doneSets}/${totalSets}`} tone="emerald" />
            <Stat label="当前总量" value={`${Math.round(currentVolume)}kg`} />
            <Stat label="状态" value={`${session.status?.energy || DEFAULT_STATUS.energy} / ${session.status?.time || DEFAULT_STATUS.time} 分`} tone="amber" />
            <Stat label="模式" value={resolveMode(session.trainingMode || 'hybrid').shortLabel} />
            <Stat label="视图" value={focusMode ? '极简' : '完整'} />
          </div>

          {focusMode ? (
            <TrainingFocusView
              session={session}
              restTimer={restTimer}
              expandedExercise={expandedExercise}
              setExpandedExercise={setExpandedExercise}
              onSetChange={onSetChange}
              onCompleteSet={onCompleteSet}
              onCopyPrevious={onCopyPrevious}
              onAdjustSet={onAdjustSet}
              onReplaceExercise={onReplaceExercise}
              onLoadFeedback={onLoadFeedback}
              onCompleteSupportSet={onCompleteSupportSet}
              onSkipSupportExercise={onSkipSupportExercise}
              onUpdateSupportSkipReason={onUpdateSupportSkipReason}
            />
          ) : (
            <>
              <SupportBlockList title="B. 纠偏块" subtitle="先把该补的补上，再进入主训练。" items={session.correctionBlock || []} tone="emerald" />
              {renderSupportTracker('纠偏完成记录', session.correctionBlock || [])}

              {session.exercises.map((exercise, exerciseIndex) => renderExerciseFullCard(exercise, exerciseIndex))}

              <SupportBlockList title="D. 功能补丁" subtitle="补单腿、抗旋转、搬运和稳定性短板。" items={session.functionalBlock || []} tone="amber" />
              {renderSupportTracker('功能补丁完成记录', session.functionalBlock || [])}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="sticky top-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">计时</div>
                <h2 className="text-xl font-black text-slate-950">休息计时器</h2>
              </div>
              <Timer className="h-6 w-6 text-emerald-600" />
            </div>
            <div className={classNames('rounded-lg p-5 text-center', restTimer?.isRunning ? 'bg-slate-950 text-white' : 'bg-stone-100 text-slate-950')}>
              <div className="text-sm font-bold text-inherit opacity-70">{restTimer?.label || '完成一组后自动开始'}</div>
              <div className="mt-2 text-5xl font-black tabular-nums">{formatTimer(remainingSec)}</div>
              <div className="mt-2 text-xs font-bold opacity-70">{restTimer && remainingSec <= 0 ? '休息结束' : restTimer?.isRunning ? '计时中' : '暂停'}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => onExtendRestTimer(30)} disabled={!restTimer} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                +30 秒
              </button>
              <button onClick={onToggleRestTimer} disabled={!restTimer} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                {restTimer?.isRunning ? '暂停' : '继续'}
              </button>
              <button onClick={onClearRestTimer} disabled={!restTimer} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">
                清零
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">为什么这样练</h2>
            <div className="space-y-2 text-sm text-slate-600">
              {explanations.length ? (
                explanations.map((item) => (
                  <div key={item} className="rounded-md bg-stone-50 p-3 leading-6 text-slate-700">
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-md bg-stone-50 p-3 text-slate-500">这里会解释今天为什么这样安排主训练、纠偏和补丁。</div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">训练备注</h2>
            <div className="space-y-2 text-sm text-slate-600">
              {notes.length ? (
                notes.map((item) => (
                  <div key={item.key} className="rounded-md bg-stone-50 p-3">
                    <span className="font-bold text-slate-950">{item.exercise}</span>：{item.note}
                  </div>
                ))
              ) : (
                <div className="rounded-md bg-stone-50 p-3 text-slate-500">这里会自动收集每组备注，方便训练后回看。</div>
              )}
            </div>
          </section>

          {focusMode && allMainDone ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="font-black text-emerald-950">主训练已完成</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">现在最适合补辅助动作；如果今天时间不够，也可以保存结束，让系统下次把计划安排得更现实。</p>
            </section>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
