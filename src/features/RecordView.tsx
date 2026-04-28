import React from 'react';
import { CalendarDays, Medal, Trash2 } from 'lucide-react';
import { buildMonthStats, buildPrs } from '../engines/analytics';
import { buildEffectiveVolumeSummary, evaluateEffectiveSet } from '../engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../engines/e1rmEngine';
import {
  classNames,
  completedSets,
  number,
  sessionCompletedSets,
  sessionVolume,
  setVolume,
  todayKey,
} from '../engines/engineUtils';
import { filterAnalyticsHistory, listSessionHistory, type SessionHistoryFilter } from '../engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../engines/trainingCalendarEngine';
import {
  formatDataFlag,
  formatExerciseName,
  formatPersonalRecordQuality,
  formatSkippedReason,
  formatTechniqueQuality,
} from '../i18n/formatters';
import { formatTrainingVolume, formatWeight } from '../engines/unitConversionEngine';
import type {
  AppData,
  PersonalRecord,
  SessionDataFlag,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
  WeeklyPrescription,
} from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/EmptyState';
import { ListItem } from '../ui/ListItem';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusBadge } from '../ui/StatusBadge';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';

export interface RecordViewProps {
  data: AppData;
  unitSettings: UnitSettings;
  weeklyPrescription: WeeklyPrescription;
  bodyWeightInput: string;
  setBodyWeightInput: React.Dispatch<React.SetStateAction<string>>;
  onSaveBodyWeight: () => void;
  onDeleteSession: (sessionId: string) => void;
  onMarkSessionDataFlag: (sessionId: string, dataFlag: SessionDataFlag) => void;
  onUpdateUnitSettings: (updates: Partial<UnitSettings>) => void;
  onRestoreData: (data: AppData) => void;
  onApplyProgramAdjustmentDraft?: unknown;
  onRollbackProgramAdjustment?: unknown;
  onStartTraining?: () => void;
  initialSection?: RecordSectionTarget;
  selectedSessionId?: string;
  selectedDate?: string;
}

type RecordSectionId = 'calendar' | 'list' | 'pr' | 'stats' | 'data';
type RecordSectionTarget = RecordSectionId | 'history' | 'dashboard';
type PrSetFilter = 'all' | 'no_pain' | 'work_sets';
type PendingRecordAction =
  | { type: 'delete'; sessionId: string }
  | { type: 'flag'; sessionId: string; dataFlag: SessionDataFlag };

const recordSections: Array<{ id: RecordSectionId; label: string; mobileLabel: string }> = [
  { id: 'calendar', label: '日历', mobileLabel: '日历' },
  { id: 'list', label: '列表', mobileLabel: '列表' },
  { id: 'pr', label: 'PR', mobileLabel: 'PR' },
  { id: 'stats', label: '统计', mobileLabel: '统计' },
  { id: 'data', label: '数据', mobileLabel: '数据' },
];

const historyFilterOptions: Array<{ id: SessionHistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'normal', label: '正常' },
  { id: 'test', label: '测试' },
  { id: 'excluded', label: '排除' },
];

const prFilterOptions: Array<{ id: PrSetFilter; label: string }> = [
  { id: 'all', label: '全部记录' },
  { id: 'no_pain', label: '排除不适' },
  { id: 'work_sets', label: '仅正式组' },
];

const normalizeSection = (section?: RecordSectionTarget): RecordSectionId => {
  if (section === 'history') return 'list';
  if (section === 'dashboard') return 'stats';
  if (section === 'list' || section === 'pr' || section === 'stats' || section === 'data') return section;
  return 'calendar';
};

const getSessionTitle = (session: TrainingSession) => session.templateName || session.focus || '未命名训练';

const sessionSortKey = (session: TrainingSession) => session.finishedAt || session.startedAt || session.date || '';

const formatSessionTime = (session: TrainingSession) => {
  const started = session.startedAt ? new Date(session.startedAt) : null;
  if (!started || Number.isNaN(started.getTime())) return '未记录时间';
  const startText = started.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const finished = session.finishedAt ? new Date(session.finishedAt) : null;
  if (!finished || Number.isNaN(finished.getTime())) return startText;
  return `${startText} - ${finished.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatSessionDuration = (session: TrainingSession) => {
  if (number(session.durationMin)) return `${Math.round(number(session.durationMin))} 分钟`;
  if (!session.startedAt || !session.finishedAt) return '未记录时长';
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '未记录时长';
  return `${Math.round((end - start) / 60000)} 分钟`;
};

const dataFlagTone = (flag?: SessionDataFlag): 'slate' | 'emerald' | 'amber' | 'rose' => {
  if (flag === 'test') return 'amber';
  if (flag === 'excluded') return 'slate';
  return 'emerald';
};

const renderFlagBadge = (flag?: SessionDataFlag) => (
  <StatusBadge tone={dataFlagTone(flag)}>{formatDataFlag(flag || 'normal')}</StatusBadge>
);

const sessionHasPain = (session: TrainingSession) =>
  (session.exercises || []).some((exercise) => Array.isArray(exercise.sets) && exercise.sets.some((set) => Boolean(set.painFlag)));

const sessionNotes = (session: TrainingSession) =>
  (session.exercises || []).flatMap((exercise) =>
    (Array.isArray(exercise.sets) ? exercise.sets : [])
      .filter((set) => set.note)
      .map((set, index) => ({
        key: `${session.id}-${exercise.id}-${set.id || index}`,
        exerciseName: formatExerciseName(exercise),
        setIndex: index + 1,
        note: set.note || '',
      })),
  );

const effectiveSetsForSession = (session: TrainingSession) => buildEffectiveVolumeSummary([session]).effectiveSets;

const formatSetType = (value?: string) => {
  if (value === 'warmup') return '热身组';
  if (value === 'corrective') return '纠偏';
  if (value === 'functional') return '功能补丁';
  if (value === 'top') return '顶组';
  if (value === 'backoff') return '回退组';
  return '正式组';
};

const formatPrValue = (record: PersonalRecord, unitSettings: UnitSettings) => {
  if (record.metric === 'volume') return formatTrainingVolume(record.raw ?? record.value, unitSettings);
  if (record.metric === 'max_weight' || record.metric === 'estimated_1rm') return formatWeight(record.raw ?? record.value, unitSettings);
  return record.displayValue || String(record.value);
};

const getMonthLeadingBlankCount = (firstDate?: string) => {
  if (!firstDate) return 0;
  const date = new Date(`${firstDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

export function RecordView({
  data,
  unitSettings,
  onDeleteSession,
  onMarkSessionDataFlag,
  onStartTraining,
  initialSection,
  selectedSessionId,
  selectedDate,
}: RecordViewProps) {
  const [activeSection, setActiveSection] = React.useState<RecordSectionId>(() => normalizeSection(initialSection));
  const [historyFilter, setHistoryFilter] = React.useState<SessionHistoryFilter>('all');
  const [selectedDateKey, setSelectedDateKey] = React.useState(selectedDate || todayKey());
  const [selectedSession, setSelectedSession] = React.useState<TrainingSession | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingRecordAction | null>(null);
  const [selectedPrExerciseId, setSelectedPrExerciseId] = React.useState('');
  const [prSetFilter, setPrSetFilter] = React.useState<PrSetFilter>('all');

  const rawHistory = data.history || [];
  const analyticsHistory = React.useMemo(() => filterAnalyticsHistory(rawHistory), [rawHistory]);
  const sortedHistory = React.useMemo(() => listSessionHistory(rawHistory, historyFilter), [rawHistory, historyFilter]);
  const calendar = React.useMemo(
    () =>
      buildTrainingCalendar(rawHistory, undefined, {
        includeDataFlags: 'all',
        importedWorkouts: data.importedWorkoutSamples || [],
        includeExternalWorkouts: data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar !== false,
      }),
    [rawHistory, data.importedWorkoutSamples, data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar],
  );
  const prs = React.useMemo(() => buildPrs(analyticsHistory), [analyticsHistory]);
  const prDates = React.useMemo(() => new Set(prs.map((item) => item.date).filter(Boolean)), [prs]);
  const monthStats = React.useMemo(() => buildMonthStats(analyticsHistory, data.bodyWeights || []), [analyticsHistory, data.bodyWeights]);
  const effectiveSummary = React.useMemo(() => buildEffectiveVolumeSummary(analyticsHistory), [analyticsHistory]);
  const monthSessionCount = calendar.days.reduce(
    (sum, day) => sum + day.sessions.filter((session) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded').length,
    0,
  );
  const recentWeeks = calendar.weeklyFrequency.slice(-4);
  const currentWeekCount = recentWeeks[recentWeeks.length - 1]?.sessionCount || 0;
  const recentWeekAverage = recentWeeks.length ? recentWeeks.reduce((sum, week) => sum + week.sessionCount, 0) / recentWeeks.length : 0;
  const selectedCalendarDay =
    calendar.days.find((day) => day.date === selectedDateKey) ||
    calendar.days.find((day) => day.totalSessions > 0 || day.totalExternalWorkouts > 0) ||
    calendar.days[0];

  const exerciseOptions = React.useMemo(() => {
    const items = new Map<string, string>();
    analyticsHistory.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        const id = getExerciseRecordPoolId(exercise);
        if (!items.has(id)) items.set(id, formatExerciseName(exercise));
      });
    });
    return [...items.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [analyticsHistory]);

  React.useEffect(() => {
    if (!selectedPrExerciseId && exerciseOptions[0]) setSelectedPrExerciseId(exerciseOptions[0].id);
  }, [exerciseOptions, selectedPrExerciseId]);

  React.useEffect(() => {
    if (initialSection) setActiveSection(normalizeSection(initialSection));
    if (selectedDate) {
      setSelectedDateKey(selectedDate);
      setActiveSection(normalizeSection(initialSection || 'calendar'));
    }
    if (selectedSessionId) {
      const next = rawHistory.find((session) => session.id === selectedSessionId) || null;
      setSelectedSession(next);
      setActiveSection(normalizeSection(initialSection || 'list'));
    }
  }, [initialSection, selectedDate, selectedSessionId, rawHistory]);

  const openSession = (sessionId: string) => {
    const session = rawHistory.find((item) => item.id === sessionId) || null;
    setSelectedSession(session);
  };

  const requestFlagChange = (sessionId: string, dataFlag: SessionDataFlag) => {
    setPendingAction({ type: 'flag', sessionId, dataFlag });
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      onDeleteSession(pendingAction.sessionId);
      setSelectedSession(null);
    } else {
      onMarkSessionDataFlag(pendingAction.sessionId, pendingAction.dataFlag);
      setSelectedSession((current) => (current?.id === pendingAction.sessionId ? { ...current, dataFlag: pendingAction.dataFlag } : current));
    }
    setPendingAction(null);
  };

  const selectedExerciseSets = React.useMemo(() => {
    if (!selectedPrExerciseId) return [];
    return analyticsHistory
      .flatMap((session) =>
        (session.exercises || [])
          .filter((exercise) => getExerciseRecordPoolId(exercise) === selectedPrExerciseId)
          .flatMap((exercise) =>
            completedSets(exercise).map((set, index) => ({
              session,
              exercise,
              set,
              setIndex: index + 1,
              volume: setVolume(set),
              effective: evaluateEffectiveSet(set, exercise),
            })),
          ),
      )
      .filter((item) => {
        if (prSetFilter === 'no_pain') return !item.set.painFlag;
        if (prSetFilter === 'work_sets') return item.set.type !== 'warmup';
        return true;
      })
      .sort((left, right) => number(right.set.weight) - number(left.set.weight) || number(right.set.reps) - number(left.set.reps));
  }, [analyticsHistory, prSetFilter, selectedPrExerciseId]);

  const selectedE1rmProfile = selectedPrExerciseId ? buildE1RMProfile(analyticsHistory, selectedPrExerciseId) : null;
  const selectedExercisePrs = selectedPrExerciseId ? prs.filter((item) => item.exerciseId === selectedPrExerciseId) : [];
  const topSet = selectedExerciseSets[0];

  const renderCalendarMarker = (day: (typeof calendar.days)[number]) => {
    const hasTraining = day.totalSessions > 0;
    const hasPr = prDates.has(day.date);
    const hasTest = day.sessions.some((session) => session.dataFlag === 'test' || session.dataFlag === 'excluded');
    return (
      <div className="mt-1 flex justify-center gap-1">
        {hasTraining ? <span aria-label="训练记录" className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
        {hasPr ? <span aria-label="PR 记录" className="h-1.5 w-1.5 rounded-full bg-violet-500" /> : null}
        {hasTest ? <span aria-label="测试或排除数据" className="h-1.5 w-1.5 rounded-full bg-slate-400" /> : null}
        {day.hasPainFlags ? <span aria-label="不适记录" className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
      </div>
    );
  };

  const renderCalendar = () => (
    <PageSection
      title="训练日历"
      description="默认从日历回看训练。绿色是训练，紫色是 PR，灰色是测试/排除数据，橙色是不适记录。"
      action={onStartTraining ? <ActionButton onClick={onStartTraining}>开始训练</ActionButton> : undefined}
    >
      {!rawHistory.length ? (
        <EmptyState
          title="暂无训练记录"
          description="完成一次训练后，这里会自动显示训练日历和当天详情。"
          action={onStartTraining ? <ActionButton onClick={onStartTraining}>开始训练</ActionButton> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="本周训练" value={`${currentWeekCount} 次`} tone="emerald" />
            <MetricCard label="本月训练" value={`${monthSessionCount} 次`} />
            <MetricCard label="近 4 周平均" value={`${recentWeekAverage.toFixed(1)} 次/周`} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_380px]">
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                <span>{calendar.month}</span>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />训练</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />PR</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />测试</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />不适</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
                {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
                  <div key={label}>{label}</div>
                ))}
                {Array.from({ length: getMonthLeadingBlankCount(calendar.days[0]?.date) }).map((_, index) => (
                  <div key={`blank-${index}`} aria-hidden="true" />
                ))}
                {calendar.days.map((day) => {
                  const selected = selectedCalendarDay?.date === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDateKey(day.date)}
                      className={classNames(
                        'min-h-14 rounded-lg border px-1 py-2 text-xs font-semibold transition',
                        selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-stone-50 text-slate-600 hover:bg-white',
                      )}
                    >
                      <div>{Number(day.date.slice(-2))}</div>
                      {renderCalendarMarker(day)}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-slate-950">{selectedCalendarDay?.date || '选择日期'}</div>
                  <div className="text-xs text-slate-500">当天训练摘要</div>
                </div>
                <CalendarDays className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="space-y-2">
                {(selectedCalendarDay?.sessions || []).map((session) => (
                  <ListItem
                    key={session.sessionId}
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        {session.title}
                        {renderFlagBadge(session.dataFlag)}
                        {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
                      </span>
                    }
                    description={`${session.templateName || '未命名模板'} · ${session.completedSets} 组 · ${session.effectiveSets} 有效组 · ${formatTrainingVolume(session.totalVolumeKg, unitSettings)}`}
                    meta={session.startTime ? formatSessionTime(rawHistory.find((item) => item.id === session.sessionId) || ({ startedAt: session.startTime } as TrainingSession)) : undefined}
                    action={<ActionButton size="sm" variant="secondary" onClick={() => openSession(session.sessionId)}>详情</ActionButton>}
                  />
                ))}
                {(selectedCalendarDay?.externalWorkouts || []).map((workout) => (
                  <ListItem
                    key={workout.workoutId}
                    title={`外部活动：${workout.workoutType}`}
                    description={`${Math.round(workout.durationMin || 0)} 分钟${workout.activeEnergyKcal ? ` · ${Math.round(workout.activeEnergyKcal)} kcal` : ''}`}
                    meta="只作为活动背景，不计入力量训练 PR / e1RM"
                  />
                ))}
                {!(selectedCalendarDay?.sessions || []).length && !(selectedCalendarDay?.externalWorkouts || []).length ? (
                  <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">当天没有训练记录。</div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageSection>
  );

  const renderHistoryList = () => (
    <PageSection title="训练列表" description="按时间倒序查看每次训练。测试和排除数据仍可查看，但默认不参与统计。">
      <div className="mb-3 flex flex-wrap gap-2">
        {historyFilterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setHistoryFilter(option.id)}
            className={classNames(
              'min-h-10 rounded-lg border px-3 text-sm font-semibold',
              historyFilter === option.id ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!sortedHistory.length ? (
        <EmptyState title="没有符合筛选的训练" description="切换筛选，或完成一次训练后再回来查看记录。" />
      ) : (
        <div className="space-y-2">
          {sortedHistory.map((session) => (
            <ListItem
              key={session.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {getSessionTitle(session)}
                  {renderFlagBadge(session.dataFlag)}
                  {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
                  {sessionHasPain(session) ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
                </span>
              }
              description={`${session.date} · ${formatSessionDuration(session)} · ${sessionCompletedSets(session)} 组 · ${effectiveSetsForSession(session)} 有效组 · ${formatTrainingVolume(sessionVolume(session), unitSettings)}`}
              meta={formatSessionTime(session)}
              action={<ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>查看详情</ActionButton>}
            />
          ))}
        </div>
      )}
    </PageSection>
  );

  const renderPr = () => (
    <PageSection title="PR / e1RM" description="按动作查看当前最佳表现、估算 e1RM 和最佳训练组。测试/排除数据不参与。">
      {!exerciseOptions.length ? (
        <EmptyState title="需要更多训练记录" description="完成正式训练后，这里会显示 PR 和估算 e1RM。" />
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">选择动作</span>
                <select
                  value={selectedPrExerciseId}
                  onChange={(event) => setSelectedPrExerciseId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500"
                >
                  {exerciseOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                {prFilterOptions.map((option) => (
                  <ActionButton
                    key={option.id}
                    size="sm"
                    variant={prSetFilter === option.id ? 'primary' : 'secondary'}
                    onClick={() => setPrSetFilter(option.id)}
                  >
                    {option.label}
                  </ActionButton>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="当前 e1RM" value={selectedE1rmProfile?.current ? formatWeight(selectedE1rmProfile.current.e1rmKg, unitSettings) : '数据不足'} tone="emerald" />
            <MetricCard label="历史最佳 e1RM" value={selectedE1rmProfile?.best ? formatWeight(selectedE1rmProfile.best.e1rmKg, unitSettings) : '数据不足'} />
            <MetricCard label="最佳单组" value={topSet ? `${formatWeight(topSet.set.weight, unitSettings)} × ${topSet.set.reps}` : '数据不足'} />
          </div>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Medal className="h-4 w-4 text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-950">当前动作记录</h3>
            </div>
            {selectedExercisePrs.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {selectedExercisePrs.map((pr) => (
                  <div key={pr.key} className="rounded-lg bg-stone-50 p-3">
                    <div className="text-xs font-semibold text-slate-500">{pr.type}</div>
                    <div className="mt-1 text-lg font-bold text-slate-950">{formatPrValue(pr, unitSettings)}</div>
                    <div className="mt-1 text-xs text-slate-500">{pr.date} · {formatPersonalRecordQuality(pr.quality)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">该动作还没有可展示的 PR。</div>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-slate-950">最佳训练组</h3>
            {selectedExerciseSets.length ? (
              <div className="space-y-2">
                {selectedExerciseSets.slice(0, 8).map((item) => (
                  <ListItem
                    key={`${item.session.id}-${item.exercise.id}-${item.set.id || item.setIndex}`}
                    title={`${formatWeight(item.set.weight, unitSettings)} × ${item.set.reps}`}
                    description={`${item.session.date} · ${getSessionTitle(item.session)} · ${item.effective.confidence === 'high' ? '高置信' : '可参考'}`}
                    meta={`RIR ${item.set.rir ?? '未记'} · ${formatTechniqueQuality(item.set.techniqueQuality || 'acceptable')}${item.set.painFlag ? ' · 有不适' : ''}`}
                    action={<ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(item.session)}>详情</ActionButton>}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">当前筛选下没有可用训练组。</div>
            )}
          </Card>
        </div>
      )}
    </PageSection>
  );

  const renderStats = () => {
    const painSessions = analyticsHistory.filter(sessionHasPain);
    const muscleRows = Object.entries(effectiveSummary.byMuscle)
      .map(([muscle, row]) => ({ muscle, ...row }))
      .sort((left, right) => right.weightedEffectiveSets - left.weightedEffectiveSets)
      .slice(0, 8);

    return (
      <PageSection title="统计" description="只统计正常训练数据。测试和排除数据不会进入频率、有效组、肌群分布和不适统计。">
        {!analyticsHistory.length ? (
          <EmptyState title="统计数据不足" description="完成训练后，这里会显示频率、有效组、肌群分布和不适趋势。" />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="本月训练" value={`${monthStats.monthSessions.length} 次`} tone="emerald" />
              <MetricCard label="总完成组" value={`${effectiveSummary.completedSets}`} />
              <MetricCard label="有效组" value={`${effectiveSummary.effectiveSets}`} />
              <MetricCard label="不适训练" value={`${painSessions.length} 次`} tone={painSessions.length ? 'amber' : 'slate'} />
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Card>
                <h3 className="mb-3 text-base font-semibold text-slate-950">最近 4 周频率</h3>
                {recentWeeks.length ? (
                  <div className="space-y-2">
                    {recentWeeks.map((week) => (
                      <div key={week.weekStart}>
                        <div className="mb-1 flex justify-between text-sm text-slate-600">
                          <span>{week.weekStart}</span>
                          <span>{week.sessionCount} 次</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, week.sessionCount * 25)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">训练记录不足。</div>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-base font-semibold text-slate-950">肌群分布</h3>
                {muscleRows.length ? (
                  <div className="space-y-2">
                    {muscleRows.map((row) => (
                      <div key={row.muscle}>
                        <div className="mb-1 flex justify-between text-sm text-slate-600">
                          <span>{row.muscle}</span>
                          <span>{Math.round(row.weightedEffectiveSets * 10) / 10} 加权有效组</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, row.weightedEffectiveSets * 10)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">还没有足够的肌群统计。</div>
                )}
              </Card>
            </div>

            <Card>
              <h3 className="mb-3 text-base font-semibold text-slate-950">不适记录</h3>
              {painSessions.length ? (
                <div className="space-y-2">
                  {painSessions.slice(0, 6).map((session) => (
                    <ListItem
                      key={session.id}
                      title={getSessionTitle(session)}
                      description={`${session.date} · 有不适组，建议回看动作质量和备注`}
                      action={<ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>详情</ActionButton>}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">正常训练数据中暂无不适标记。</div>
              )}
            </Card>
          </div>
        )}
      </PageSection>
    );
  };

  const renderData = () => {
    const normalCount = rawHistory.filter((session) => !session.dataFlag || session.dataFlag === 'normal').length;
    const testCount = rawHistory.filter((session) => session.dataFlag === 'test').length;
    const excludedCount = rawHistory.filter((session) => session.dataFlag === 'excluded').length;
    const dataRows = [...rawHistory].sort((left, right) => sessionSortKey(right).localeCompare(sessionSortKey(left)));

    return (
      <PageSection title="训练记录数据" description="这里只管理训练记录本身：删除、标记测试、恢复正常、排除统计。单位、健康数据和全局备份在“我的”页。">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="正常记录" value={`${normalCount}`} tone="emerald" />
          <MetricCard label="测试记录" value={`${testCount}`} tone="amber" />
          <MetricCard label="排除记录" value={`${excludedCount}`} />
        </div>
        {!dataRows.length ? (
          <EmptyState title="暂无训练记录" description="完成一次训练后，可以在这里管理该训练是否参与统计。" />
        ) : (
          <div className="mt-3 space-y-2">
            {dataRows.map((session) => (
              <ListItem
                key={session.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {getSessionTitle(session)}
                    {renderFlagBadge(session.dataFlag)}
                  </span>
                }
                description={`${session.date} · ${sessionCompletedSets(session)} 组 · ${formatTrainingVolume(sessionVolume(session), unitSettings)}`}
                action={
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>详情</ActionButton>
                    <ActionButton size="sm" variant="secondary" onClick={() => requestFlagChange(session.id, 'test')}>标记测试</ActionButton>
                    <ActionButton size="sm" variant="ghost" onClick={() => requestFlagChange(session.id, 'normal')}>恢复正常</ActionButton>
                    <ActionButton size="sm" variant="danger" onClick={() => setPendingAction({ type: 'delete', sessionId: session.id })}>删除</ActionButton>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </PageSection>
    );
  };

  const renderSessionDrawer = () => {
    const session = selectedSession;
    if (!session) return null;
    const notes = sessionNotes(session);
    const effective = buildEffectiveVolumeSummary([session]);

    return (
      <Drawer open={Boolean(selectedSession)} title="训练详情" onClose={() => setSelectedSession(null)}>
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-slate-950">{getSessionTitle(session)}</div>
              {renderFlagBadge(session.dataFlag)}
              {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
              {sessionHasPain(session) ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">{session.date} · {formatSessionTime(session)} · {formatSessionDuration(session)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricCard label="完成组数" value={`${sessionCompletedSets(session)}`} />
              <MetricCard label="有效组" value={`${effective.effectiveSets}`} tone="emerald" />
              <MetricCard label="总量" value={formatTrainingVolume(sessionVolume(session), unitSettings)} />
              <MetricCard label="训练状态" value={formatDataFlag(session.dataFlag || 'normal')} />
            </div>
          </Card>

          <PageSection title="表现概览">
            <Card>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">高置信有效组</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{effective.highConfidenceEffectiveSets}</div>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">中低置信有效组</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{effective.mediumConfidenceEffectiveSets + effective.lowConfidenceEffectiveSets}</div>
                </div>
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">不适标记</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{sessionHasPain(session) ? '有' : '无'}</div>
                </div>
              </div>
            </Card>
          </PageSection>

          <PageSection title="动作记录">
            {(session.exercises || []).map((exercise) => {
              const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
              return (
                <Card key={`${session.id}-${exercise.id}`} className="space-y-2">
                  <div className="font-semibold text-slate-950">{formatExerciseName(exercise)}</div>
                  {exercise.originalExerciseId && exercise.actualExerciseId && exercise.originalExerciseId !== exercise.actualExerciseId ? (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      原计划：{formatExerciseName(exercise.originalExerciseId)} / 实际执行：{formatExerciseName(exercise.actualExerciseId)}
                    </div>
                  ) : null}
                  <div className="space-y-1 text-xs font-semibold text-slate-600">
                    {sets.length ? (
                      sets.map((set: TrainingSetLog, index: number) => (
                        <div key={set.id || `${exercise.id}-${index}`} className="rounded-md bg-stone-50 px-3 py-2">
                          {formatSetType(set.type)} {index + 1}：{formatWeight(set.actualWeightKg ?? set.weight, unitSettings)} × {set.reps}
                          {set.rir !== undefined && set.rir !== '' ? ` / RIR ${set.rir}` : ''}
                          {set.techniqueQuality ? ` / ${formatTechniqueQuality(set.techniqueQuality)}` : ''}
                          {set.painFlag ? ' / 有不适' : ''}
                          {set.note ? ` / ${set.note}` : ''}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md bg-stone-50 px-3 py-2 text-slate-500">没有组记录。</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </PageSection>

          {(session.supportExerciseLogs || []).length ? (
            <PageSection title="纠偏 / 功能补丁">
              {(session.supportExerciseLogs || []).map((log) => (
                <ListItem
                  key={`${log.moduleId}-${log.exerciseId}`}
                  title={log.exerciseName || formatExerciseName(log.exerciseId)}
                  description={`${log.completedSets}/${log.plannedSets} 组${log.skippedReason ? ` · 跳过原因：${formatSkippedReason(log.skippedReason)}` : ''}`}
                  meta={log.blockType === 'correction' ? '纠偏模块' : '功能补丁'}
                />
              ))}
            </PageSection>
          ) : null}

          <PageSection title="备注">
            {notes.length ? (
              <div className="space-y-2">
                {notes.map((item) => (
                  <div key={item.key} className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-600">
                    <span className="font-semibold text-slate-950">{item.exerciseName} 第 {item.setIndex} 组：</span>
                    {item.note}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">本次训练没有备注。</div>
            )}
          </PageSection>

          <PageSection title="操作">
            <div className="grid gap-2 sm:grid-cols-4">
              <ActionButton variant="danger" onClick={() => setPendingAction({ type: 'delete', sessionId: session.id })}>
                <Trash2 className="h-4 w-4" />
                删除记录
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => requestFlagChange(session.id, 'test')}>
                标记测试
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => requestFlagChange(session.id, 'normal')}>
                恢复正常
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => requestFlagChange(session.id, 'excluded')}>
                排除统计
              </ActionButton>
            </div>
          </PageSection>
        </div>
      </Drawer>
    );
  };

  const pendingActionCopy =
    pendingAction?.type === 'delete'
      ? {
          title: '删除训练记录？',
          description: '删除后该训练不会计入记录、PR、e1RM、有效组、完成度和日历。此操作不可恢复，建议先导出全局备份。',
          confirmLabel: '删除',
        }
      : pendingAction?.dataFlag === 'normal'
        ? {
            title: '恢复为正常训练？',
            description: '恢复后该训练会重新参与统计、PR、e1RM、有效组和日历。',
            confirmLabel: '恢复正常',
          }
        : pendingAction?.dataFlag === 'test'
          ? {
              title: '标记为测试数据？',
              description: '测试数据仍可查看，但默认不会参与统计、PR、e1RM 和有效组。',
              confirmLabel: '标记测试',
            }
          : {
              title: '排除这次训练？',
              description: '排除数据仍可查看，但不会参与统计、PR、e1RM、有效组和日历。',
              confirmLabel: '排除统计',
            };

  return (
    <ResponsivePageLayout>
      <PageHeader
        eyebrow="记录"
        title="训练记录中心"
        description="默认从日历进入，回答“我以前哪天练了什么”。"
      />
      <div className="space-y-4">
        <SegmentedControl value={activeSection} options={recordSections} onChange={setActiveSection} ariaLabel="记录中心分区" />
        {activeSection === 'calendar' ? renderCalendar() : null}
        {activeSection === 'list' ? renderHistoryList() : null}
        {activeSection === 'pr' ? renderPr() : null}
        {activeSection === 'stats' ? renderStats() : null}
        {activeSection === 'data' ? renderData() : null}
      </div>
      {renderSessionDrawer()}
      {pendingAction ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/30 p-4">
          <ConfirmDialog
            title={pendingActionCopy.title}
            description={pendingActionCopy.description}
            confirmLabel={pendingActionCopy.confirmLabel}
            danger={pendingAction.type === 'delete' || pendingAction.dataFlag === 'excluded'}
            onCancel={() => setPendingAction(null)}
            onConfirm={confirmPendingAction}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
