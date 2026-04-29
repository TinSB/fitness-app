import React from 'react';
import { AlertTriangle, CheckCircle2, Circle, Dumbbell, FileText, Timer, XCircle } from 'lucide-react';
import { classNames, formatTimer, number, resolveMode, sessionVolume } from '../engines/engineUtils';
import { getRestTimerRemainingSec } from '../engines/restTimerEngine';
import { buildSessionQualityResult } from '../engines/sessionQualityEngine';
import { convertKgToDisplayWeight, formatTrainingVolume, parseDisplayWeightToKg } from '../engines/unitConversionEngine';
import { formatExerciseName, formatRirLabel, formatSetType, formatSkippedReason, formatTechniqueQuality, formatTemplateName, formatTrainingMode } from '../i18n/formatters';
import type {
  CorrectionModule,
  ExercisePrescription,
  FunctionalAddon,
  LoadFeedbackValue,
  RestTimerState,
  SupportBlockType,
  SupportSkipReason,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
  WeightUnit,
} from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { ListItem } from '../ui/ListItem';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { WorkoutActionBar } from '../ui/WorkoutActionBar';
import { RecommendationExplanationPanel } from '../ui/RecommendationExplanationPanel';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { buildSessionRecommendationTrace } from '../presenters/recommendationExplanationPresenter';

type LoggedExercise = ExercisePrescription & {
  increment?: number;
};

type ExerciseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

interface TrainingViewProps {
  session: TrainingSession | null;
  unitSettings: UnitSettings;
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
  onApplySuggestion: (exerciseIndex: number) => void;
  onUpdateActualDraft: (
    exerciseIndex: number,
    updates: {
      actualWeightKg?: number;
      displayWeight?: number;
      displayUnit?: WeightUnit;
      actualReps?: number;
      actualRir?: number;
      techniqueQuality?: TrainingSetLog['techniqueQuality'];
      painFlag?: boolean;
    }
  ) => void;
  onSwitchExercise: (exerciseIndex: number) => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onSkipSupportBlock: (blockType: 'correction' | 'functional', reason: SupportSkipReason) => void;
  onUpdateSupportSkipReason: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onReplaceExercise: (exerciseIndex: number, replacementId?: string) => void;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish: () => void;
  onFinishToCalendar?: () => void;
  onFinishToToday?: () => void;
  onDelete: () => void;
  onReturnFocusMode?: () => void;
  onExtendRestTimer: (seconds: number) => void;
  onToggleRestTimer: () => void;
  onClearRestTimer: () => void;
  onGoToday: () => void;
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

const techniqueOptions: Array<{ value: NonNullable<TrainingSetLog['techniqueQuality']>; label: string }> = [
  { value: 'good', label: formatTechniqueQuality('good') },
  { value: 'acceptable', label: formatTechniqueQuality('acceptable') },
  { value: 'poor', label: formatTechniqueQuality('poor') },
];

const loadFeedbackOptions: Array<{ value: LoadFeedbackValue; label: string }> = [
  { value: 'too_light', label: '偏轻' },
  { value: 'good', label: '合适' },
  { value: 'too_heavy', label: '偏重' },
];

const getSets = (exercise: LoggedExercise | undefined): TrainingSetLog[] =>
  Array.isArray(exercise?.sets) ? (exercise.sets as TrainingSetLog[]) : [];

const templateLabel = (id: string, fallback: string) => formatTemplateName(id || fallback, '当前训练');

const exerciseStatusLabel: Record<ExerciseStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  skipped: '已跳过',
};

const exerciseStatusTone: Record<ExerciseStatus, 'slate' | 'emerald' | 'amber' | 'rose' | 'sky'> = {
  not_started: 'slate',
  in_progress: 'amber',
  completed: 'emerald',
  skipped: 'rose',
};

const findNextUnfinishedSetIndex = (exercise: LoggedExercise) => getSets(exercise).findIndex((set) => !set.done);

const getExerciseStatus = (exercise: LoggedExercise, isCurrent: boolean): ExerciseStatus => {
  const sets = getSets(exercise);
  if (!sets.length) return 'skipped';
  const done = sets.filter((set) => set.done).length;
  if (done >= sets.length) return 'completed';
  if (done > 0 || isCurrent) return 'in_progress';
  return 'not_started';
};

const statusIcon = (status: ExerciseStatus) => {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'skipped') return <XCircle className="h-4 w-4 text-rose-600" />;
  if (status === 'in_progress') return <Timer className="h-4 w-4 text-amber-600" />;
  return <Circle className="h-4 w-4 text-slate-300" />;
};

const supportLogKey = (moduleId: string, exerciseId: string) => `${moduleId}:${exerciseId}`;

const getSupportExerciseName = (exercise: { exerciseId: string; name?: string }) =>
  formatExerciseName({ id: exercise.exerciseId, name: exercise.name });

const plannedSupportSets = (exercise: { sets: number }) => Math.max(0, number(exercise.sets));

const supportBlockLabel = (blockType: SupportBlockType) => (blockType === 'correction' ? '纠偏模块' : '功能补丁');

const formatRest = (seconds?: number) => {
  const safe = Math.max(0, number(seconds));
  if (!safe) return '按需';
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  if (!minutes) return `${remain} 秒`;
  return remain ? `${minutes} 分 ${remain} 秒` : `${minutes} 分`;
};

const formatDisplayWeightValue = (weightKg: unknown, unitSettings: UnitSettings) =>
  String(convertKgToDisplayWeight(weightKg, unitSettings.weightUnit));

export function TrainingView({
  session,
  unitSettings,
  restTimer,
  expandedExercise,
  setExpandedExercise,
  onStartFromSelected,
  onSetChange,
  onCompleteSet,
  onCopyPrevious,
  onAdjustSet,
  onApplySuggestion,
  onUpdateActualDraft,
  onSwitchExercise,
  onCompleteSupportSet,
  onSkipSupportExercise,
  onSkipSupportBlock,
  onUpdateSupportSkipReason,
  onReplaceExercise,
  onLoadFeedback,
  onFinish,
  onFinishToCalendar,
  onFinishToToday,
  onDelete,
  onReturnFocusMode,
  onExtendRestTimer,
  onToggleRestTimer,
  onClearRestTimer,
  onGoToday,
}: TrainingViewProps) {
  const [supportReasonDrafts, setSupportReasonDrafts] = React.useState<Record<string, SupportSkipReason>>({});
  const [showFinishConfirm, setShowFinishConfirm] = React.useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = React.useState(false);

  React.useEffect(() => {
    setSupportReasonDrafts({});
    setShowFinishConfirm(false);
    setShowAbandonConfirm(false);
  }, [session?.id]);

  if (!session) {
    return (
      <ResponsivePageLayout>
        <PageHeader
          eyebrow="训练"
          title="训练工作台"
          description="用于查看、补记和结束当前训练；手机端快速记录优先使用极简模式。"
        />
        <EmptyState
          title="当前没有进行中的训练"
          description="从今日页开始一场训练，或者直接用当前模板开始。"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton variant="primary" onClick={onStartFromSelected}>
                用当前模板开始
              </ActionButton>
              <ActionButton variant="secondary" onClick={onGoToday}>
                回到今日
              </ActionButton>
            </div>
          }
        />
      </ResponsivePageLayout>
    );
  }

  const mainExercises = session.exercises as LoggedExercise[];
  const totalSets = mainExercises.reduce((sum, exercise) => sum + getSets(exercise).length, 0);
  const doneSets = mainExercises.reduce((sum, exercise) => sum + getSets(exercise).filter((set) => set.done).length, 0);
  const currentVolume = sessionVolume(session);
  const nextExerciseIndex = mainExercises.findIndex((exercise) => findNextUnfinishedSetIndex(exercise) >= 0);
  const activeExerciseIndex = nextExerciseIndex >= 0 ? nextExerciseIndex : Math.max(0, Math.min(expandedExercise, mainExercises.length - 1));
  const activeExercise = mainExercises[activeExerciseIndex];
  const activeSetIndex = activeExercise ? findNextUnfinishedSetIndex(activeExercise) : -1;
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const mode = resolveMode(session.trainingMode || 'hybrid');
  const recommendationTrace = React.useMemo(() => buildSessionRecommendationTrace(session), [session]);

  const getSupportLog = (moduleId: string, exerciseId: string) =>
    (session.supportExerciseLogs || []).find((item) => item.moduleId === moduleId && item.exerciseId === exerciseId);

  const supportSummary = [...(session.correctionBlock || []), ...(session.functionalBlock || [])].reduce(
    (summary, block) => {
      block.exercises.forEach((exercise) => {
        const log = getSupportLog(block.id, exercise.exerciseId);
        const planned = log?.plannedSets || plannedSupportSets(exercise);
        const completed = Math.min(number(log?.completedSets), planned);
        const resolved = log?.skippedReason ? planned : completed;
        summary.planned += planned;
        summary.completed += completed;
        summary.resolved += resolved;
        if (log?.skippedReason) summary.skipped += 1;
      });
      return summary;
    },
    { planned: 0, completed: 0, resolved: 0, skipped: 0 }
  );

  const overallPlanned = totalSets + supportSummary.planned;
  const overallResolved = doneSets + supportSummary.resolved;
  const overallPercent = overallPlanned ? Math.round((overallResolved / overallPlanned) * 100) : 0;
  const allMainDone = totalSets > 0 && doneSets >= totalSets;
  const supportResolved = supportSummary.resolved >= supportSummary.planned;
  const workoutFinished = allMainDone && supportResolved;
  const sessionQuality = React.useMemo(() => buildSessionQualityResult({ session }), [session]);
  const sessionQualityItems = [...sessionQuality.positives, ...sessionQuality.issues].slice(0, 3);
  const notes = mainExercises.flatMap((exercise) =>
    getSets(exercise)
      .filter((set) => set.note)
      .map((set, setIndex) => ({
        key: `${exercise.id}-${set.id}-note`,
        exercise: formatExerciseName(exercise),
        setIndex,
        note: set.note || '',
      }))
  );

  const requestFinish = (target?: 'calendar' | 'today') => {
    const finish = target === 'calendar' ? onFinishToCalendar || onFinish : target === 'today' ? onFinishToToday || onFinish : onFinish;
    if (workoutFinished) {
      finish();
      return;
    }
    setShowFinishConfirm(true);
  };

  const renderSetSummary = (set: TrainingSetLog, setIndex: number) => {
    const weightKg = set.actualWeightKg ?? set.weight;
    const reps = set.reps;
    return (
      <div key={set.id} className="flex flex-wrap items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-xs text-slate-600">
        <StatusBadge tone="emerald">{formatSetType(set.type)} {setIndex + 1}</StatusBadge>
        <span className="font-semibold text-slate-900">
          {formatDisplayWeightValue(weightKg, unitSettings)}{unitSettings.weightUnit} × {number(reps)}
        </span>
        {set.rir !== undefined && set.rir !== '' ? <span>{formatRirLabel(set.rir)}</span> : null}
        {set.techniqueQuality ? <span>{formatTechniqueQuality(set.techniqueQuality)}</span> : null}
        {set.painFlag ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
      </div>
    );
  };

  const renderExerciseDetail = (exercise: LoggedExercise, exerciseIndex: number) => {
    const sets = getSets(exercise);
    const nextSetIndex = findNextUnfinishedSetIndex(exercise);
    const allDone = nextSetIndex === -1;
    const increment = typeof exercise.increment === 'number' ? exercise.increment : unitSettings.defaultIncrementKg;
    const displayIncrement = unitSettings.weightUnit === 'lb' ? unitSettings.defaultIncrementLb : increment;
    const incrementDeltaKg = unitSettings.weightUnit === 'lb' ? parseDisplayWeightToKg(displayIncrement, 'lb') : increment;

    return (
      <div className="border-t border-slate-100 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="bg-stone-50" padded>
            <div className="text-xs font-semibold text-slate-500">本次建议</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{exercise.suggestion || exercise.targetSummary || '按计划完成本动作'}</div>
          </Card>
          <Card className="bg-stone-50" padded>
            <div className="text-xs font-semibold text-slate-500">目标范围</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">
              {exercise.repMin}-{exercise.repMax} 次 · {formatRirLabel(exercise.targetRirText || '1–2')}
            </div>
          </Card>
          <Card className="bg-stone-50" padded>
            <div className="text-xs font-semibold text-slate-500">休息</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{formatRest(exercise.rest)}</div>
          </Card>
        </div>

        <div className="mt-4 space-y-3">
          {sets.map((set, setIndex) => {
            const isNext = setIndex === nextSetIndex;
            const weightKg = set.actualWeightKg ?? set.weight;
            const displayWeight = convertKgToDisplayWeight(weightKg, unitSettings.weightUnit);
            return (
              <Card
                key={set.id}
                className={classNames(
                  'border-slate-200',
                  set.done && 'bg-emerald-50/50',
                  isNext && 'border-emerald-300 ring-1 ring-emerald-100'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={set.done ? 'emerald' : isNext ? 'amber' : 'slate'}>
                        {set.done ? '已完成' : isNext ? '当前组' : '待完成'}
                      </StatusBadge>
                      <h3 className="text-sm font-semibold text-slate-950">
                        {formatSetType(set.type)} {setIndex + 1}
                      </h3>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      推荐处方与实际记录分开；这里用于补记或修正本组数据。
                    </div>
                  </div>
                  {!set.done && isNext ? (
                    <ActionButton
                      size="sm"
                      variant="primary"
                      onClick={() => onCompleteSet(exerciseIndex)}
                      disabled={!number(set.weight) || !number(set.reps)}
                    >
                      完成这组
                    </ActionButton>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">重量（{unitSettings.weightUnit}）</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={String(displayWeight)}
                      onChange={(event) =>
                        onSetChange(exerciseIndex, setIndex, 'weight', String(parseDisplayWeightToKg(event.target.value, unitSettings.weightUnit)))
                      }
                      className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">次数</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={String(set.reps ?? '')}
                      onChange={(event) => onSetChange(exerciseIndex, setIndex, 'reps', event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">余力（RIR）</span>
                    <input
                      value={String(set.rir ?? '')}
                      onChange={(event) => onSetChange(exerciseIndex, setIndex, 'rir', event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500"
                      placeholder={exercise.targetRirText || '1-2'}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">RPE</span>
                    <input
                      value={String(set.rpe ?? '')}
                      onChange={(event) => onSetChange(exerciseIndex, setIndex, 'rpe', event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500"
                      placeholder="8"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-500">动作质量</div>
                    <div className="grid grid-cols-3 gap-2">
                      {techniqueOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onSetChange(exerciseIndex, setIndex, 'techniqueQuality', option.value)}
                          className={classNames(
                            'min-h-10 rounded-lg border px-2 text-sm font-medium transition',
                            (set.techniqueQuality || 'acceptable') === option.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-600'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(set.painFlag)}
                      onChange={(event) => onSetChange(exerciseIndex, setIndex, 'painFlag', event.target.checked)}
                    />
                    这组有不适
                  </label>
                </div>

                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">本组备注</span>
                  <input
                    value={set.note || ''}
                    onChange={(event) => onSetChange(exerciseIndex, setIndex, 'note', event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500"
                    placeholder="例如：肩不舒服、节奏乱了、器械被占"
                  />
                </label>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <ActionButton variant="secondary" onClick={() => onAdjustSet(exerciseIndex, 'weight', -incrementDeltaKg)} disabled={allDone}>
            -{displayIncrement}{unitSettings.weightUnit}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => onAdjustSet(exerciseIndex, 'weight', incrementDeltaKg)} disabled={allDone}>
            +{displayIncrement}{unitSettings.weightUnit}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => onCopyPrevious(exerciseIndex)} disabled={allDone || nextSetIndex <= 0}>
            复制上组
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => onApplySuggestion(exerciseIndex)} disabled={allDone}>
            套用建议
          </ActionButton>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <ActionButton variant="ghost" onClick={() => onSwitchExercise(exerciseIndex)}>
            设为当前动作
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => onReplaceExercise(exerciseIndex)}>
            选择替代动作
          </ActionButton>
          <div className="grid grid-cols-3 gap-2">
            {loadFeedbackOptions.map((option) => (
              <ActionButton key={option.value} size="sm" variant="ghost" onClick={() => onLoadFeedback(exercise.actualExerciseId || exercise.id, option.value)}>
                {option.label}
              </ActionButton>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderExerciseCard = (exercise: LoggedExercise, exerciseIndex: number) => {
    const sets = getSets(exercise);
    const done = sets.filter((set) => set.done).length;
    const active = expandedExercise === exerciseIndex;
    const status = getExerciseStatus(exercise, exerciseIndex === activeExerciseIndex);
    const completedSets = sets.filter((set) => set.done);

    return (
      <Card key={`${exercise.id}-${exerciseIndex}`} padded={false} className={classNames(active && 'border-emerald-300 ring-1 ring-emerald-100')}>
        <button
          type="button"
          onClick={() => setExpandedExercise(active ? -1 : exerciseIndex)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {statusIcon(status)}
              <h2 className="truncate text-base font-semibold text-slate-950">{formatExerciseName(exercise)}</h2>
              <StatusBadge tone={exerciseStatusTone[status]}>{exerciseStatusLabel[status]}</StatusBadge>
              {exercise.actualExerciseId && exercise.originalExerciseId && exercise.actualExerciseId !== exercise.originalExerciseId ? (
                <StatusBadge tone="amber">已替代</StatusBadge>
              ) : null}
            </div>
            <div className="mt-1 line-clamp-2 text-sm text-slate-500">
              {exercise.targetSummary || exercise.suggestion || `${exercise.repMin}-${exercise.repMax} 次 · ${formatRest(exercise.rest)}`}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold text-slate-950">
              {done}/{sets.length}
            </div>
            <div className="text-xs text-slate-400">组数</div>
          </div>
        </button>

        {completedSets.length ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">已完成组</div>
            <div className="flex flex-col gap-2">{completedSets.map(renderSetSummary)}</div>
          </div>
        ) : null}

        {active ? renderExerciseDetail(exercise, exerciseIndex) : null}
      </Card>
    );
  };

  const renderSupportBlock = (title: string, blockType: SupportBlockType, items: Array<CorrectionModule | FunctionalAddon>) => {
    if (!items.length) return null;
    const reasonForBlock = supportReasonDrafts[`${blockType}:block`] || 'time';

    return (
      <PageSection
        title={title}
        description="纠偏和功能补丁会单独记录；跳过时会保留原因，便于训练后复盘。"
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={reasonForBlock}
              onChange={(event) => setSupportReasonDrafts((current) => ({ ...current, [`${blockType}:block`]: event.target.value as SupportSkipReason }))}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              {supportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ActionButton size="sm" variant="danger" onClick={() => onSkipSupportBlock(blockType, reasonForBlock)}>
              跳过整个{supportBlockLabel(blockType)}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-3">
          {items.map((block) => (
            <Card key={block.id} className="bg-white">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{block.name}</h3>
                  <div className="mt-1 text-xs text-slate-500">预计 {block.durationMin} 分钟</div>
                </div>
                <StatusBadge tone={blockType === 'correction' ? 'emerald' : 'amber'}>{supportBlockLabel(blockType)}</StatusBadge>
              </div>
              <div className="space-y-2">
                {block.exercises.map((exercise) => {
                  const log = getSupportLog(block.id, exercise.exerciseId);
                  const planned = log?.plannedSets || plannedSupportSets(exercise);
                  const completed = number(log?.completedSets);
                  const skipped = Boolean(log?.skippedReason);
                  const status: ExerciseStatus = skipped ? 'skipped' : completed >= planned ? 'completed' : completed > 0 ? 'in_progress' : 'not_started';
                  const draftKey = supportLogKey(block.id, exercise.exerciseId);
                  const reason = supportReasonDrafts[draftKey] || log?.skippedReason || 'time';

                  return (
                    <ListItem
                      key={`${block.id}-${exercise.exerciseId}`}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          {getSupportExerciseName(exercise)}
                          <StatusBadge tone={exerciseStatusTone[status]}>{exerciseStatusLabel[status]}</StatusBadge>
                        </span>
                      }
                      description={`计划 ${planned} 组，已完成 ${completed} 组${log?.skippedReason ? `，跳过原因：${formatSkippedReason(log.skippedReason)}` : ''}`}
                      action={
                        <div className="grid min-w-[210px] grid-cols-[1fr_auto] gap-2">
                          <select
                            value={reason}
                            onChange={(event) => {
                              const nextReason = event.target.value as SupportSkipReason;
                              setSupportReasonDrafts((current) => ({ ...current, [draftKey]: nextReason }));
                              onUpdateSupportSkipReason(block.id, exercise.exerciseId, nextReason);
                            }}
                            className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                          >
                            {supportReasonOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <ActionButton size="sm" variant="primary" onClick={() => onCompleteSupportSet(block.id, exercise.exerciseId)} disabled={completed >= planned}>
                              完成
                            </ActionButton>
                            <ActionButton size="sm" variant="danger" onClick={() => onSkipSupportExercise(block.id, exercise.exerciseId, reason)}>
                              跳过
                            </ActionButton>
                          </div>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </PageSection>
    );
  };

  return (
    <ResponsivePageLayout className="pb-36 md:pb-6">
      <PageHeader
        eyebrow="训练"
        title={templateLabel(session.templateId, session.templateName)}
        description="完整训练页用于查看整体流程、补记每组数据、处理纠偏/功能补丁，并在训练结束时保存。"
        action={
          <div className="hidden flex-wrap gap-2 md:flex">
            <ActionButton type="button" variant="secondary" onClick={onReturnFocusMode}>
              返回极简模式
            </ActionButton>
            <ActionButton type="button" variant="danger" onClick={() => setShowAbandonConfirm(true)}>
              放弃训练
            </ActionButton>
            <ActionButton type="button" variant="primary" onClick={() => requestFinish()}>
              结束训练
            </ActionButton>
          </div>
        }
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">本次训练进度</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {overallResolved}/{overallPlanned || 1} 项已处理
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  这里用于查看全流程、展开动作补记、修正记录，快速记录仍建议回到极简模式。
                </p>
              </div>
              <div className="min-w-[160px]">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>完成度</span>
                  <span>{overallPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, overallPercent)}%` }} />
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="主训练组" value={`${doneSets}/${totalSets}`} tone="emerald" />
            <MetricCard label="当前总量" value={formatTrainingVolume(currentVolume, unitSettings)} />
            <MetricCard label="辅助处理" value={`${supportSummary.resolved}/${supportSummary.planned}`} helper={supportSummary.skipped ? `${supportSummary.skipped} 项已跳过` : undefined} />
            <MetricCard label="训练模式" value={formatTrainingMode(mode.id)} tone="sky" />
          </div>

          <RecommendationExplanationPanel trace={recommendationTrace} compact maxVisibleFactors={3} />

          {workoutFinished ? (
            <PageSection title="完成总结" description="保存前先看本次训练质量；这里不会自动改计划。">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-slate-950">{sessionQuality.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{sessionQuality.summary}</p>
                  </div>
                  <StatusBadge tone={sessionQuality.level === 'high' ? 'emerald' : sessionQuality.level === 'low' ? 'amber' : 'sky'}>
                    {sessionQuality.confidence === 'high' ? '高置信' : sessionQuality.confidence === 'medium' ? '中等置信' : '低置信'}
                  </StatusBadge>
                </div>
                {sessionQualityItems.length ? (
                  <div className="space-y-2">
                    {sessionQualityItems.map((item) => (
                      <div key={item.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-600">
                        <span className="font-semibold text-slate-950">{item.label}：</span>
                        {item.reason}
                      </div>
                    ))}
                  </div>
                ) : null}
                {sessionQuality.nextSuggestions.length ? (
                  <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-700">下次建议</summary>
                    <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {sessionQuality.nextSuggestions.slice(0, 3).map((item) => (
                        <div key={item}>- {item}</div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </Card>
            </PageSection>
          ) : null}

          <PageSection title="完整动作列表" description="展开动作可补记重量、次数、RIR、动作质量、不适和备注。">
            <div className="space-y-3">{mainExercises.map((exercise, index) => renderExerciseCard(exercise, index))}</div>
          </PageSection>

          {renderSupportBlock('纠偏模块', 'correction', session.correctionBlock || [])}
          {renderSupportBlock('功能补丁', 'functional', session.functionalBlock || [])}
        </main>

        <aside className="min-w-0 space-y-4">
          <Card className="xl:sticky xl:top-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">下一步</div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {workoutFinished ? '可以结束训练' : activeExercise ? formatExerciseName(activeExercise) : '处理剩余项目'}
                </h2>
              </div>
              <Dumbbell className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-600">
              {workoutFinished
                ? '主训练和辅助项目都已处理，可以保存并结束。'
                : activeExercise && activeSetIndex >= 0
                  ? `继续完成第 ${activeSetIndex + 1} 组，或展开动作补记细节。`
                  : '主训练已完成，请检查纠偏模块和功能补丁是否需要补记或跳过。'}
            </div>
            <div className="mt-3 grid gap-2">
              <ActionButton variant="primary" onClick={() => requestFinish()}>
                结束训练
              </ActionButton>
              <ActionButton variant="secondary" onClick={onReturnFocusMode}>
                返回极简模式
              </ActionButton>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">休息计时</div>
                <h2 className="text-lg font-semibold text-slate-950">休息计时器</h2>
              </div>
              <Timer className="h-5 w-5 text-emerald-600" />
            </div>
            <div className={classNames('rounded-lg p-4 text-center', restTimer?.isRunning ? 'bg-slate-950 text-white' : 'bg-stone-100 text-slate-950')}>
              <div className="text-xs font-medium opacity-70">{restTimer?.label || '完成一组后自动开始'}</div>
              <div className="mt-2 text-4xl font-bold tabular-nums">{formatTimer(remainingSec)}</div>
              <div className="mt-1 text-xs opacity-70">{restTimer && remainingSec <= 0 ? '休息结束' : restTimer?.isRunning ? '计时中' : '未运行'}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ActionButton size="sm" variant="secondary" onClick={() => onExtendRestTimer(30)} disabled={!restTimer}>
                +30秒
              </ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={onToggleRestTimer} disabled={!restTimer}>
                {restTimer?.isRunning ? '暂停' : '继续'}
              </ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={onClearRestTimer} disabled={!restTimer}>
                清零
              </ActionButton>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-950">训练备注</h2>
            </div>
            {notes.length ? (
              <div className="space-y-2">
                {notes.map((item) => (
                  <div key={item.key} className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-600">
                    <span className="font-semibold text-slate-950">{item.exercise} 第 {item.setIndex + 1} 组：</span>
                    {item.note}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-500">
                暂无备注。展开动作后可在每组下方补记情况。
              </div>
            )}
          </Card>

          <Card tone="amber">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm leading-6">
                <div className="font-semibold">完整页用于复盘和补记</div>
                <div className="mt-1 opacity-80">训练中快速完成一组、替代动作或标记不适，优先回到极简模式。</div>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <WorkoutActionBar className="bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-auto">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_1fr] gap-2 md:flex md:justify-end">
          <ActionButton variant="secondary" onClick={onReturnFocusMode} fullWidth>
            返回极简
          </ActionButton>
          <ActionButton variant="primary" onClick={() => requestFinish()} fullWidth>
            结束训练
          </ActionButton>
        </div>
      </WorkoutActionBar>

      {showFinishConfirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-[1px]">
          <ConfirmDialog
            title="确认结束未完成训练？"
            description="当前还有动作或辅助项目没有处理。确认后会按现有记录保存本次训练，未完成内容不会自动补齐。"
            confirmText="保存并结束"
            cancelText="继续训练"
            variant="warning"
            onCancel={() => setShowFinishConfirm(false)}
            onConfirm={() => {
              setShowFinishConfirm(false);
              onFinish();
            }}
          />
        </div>
      ) : null}

      {showAbandonConfirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-[1px]">
          <ConfirmDialog
            title="放弃当前训练？"
            description="当前未保存的训练记录将不会进入历史。"
            confirmText="放弃训练"
            cancelText="继续训练"
            variant="danger"
            onCancel={() => setShowAbandonConfirm(false)}
            onConfirm={() => {
              setShowAbandonConfirm(false);
              onDelete();
            }}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
