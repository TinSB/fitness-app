import React from 'react';
import { Medal, Trash2 } from 'lucide-react';
import { buildMonthStats, buildPrs } from '../engines/analytics';
import { buildDataHealthClaritySummary } from '../engines/dataHealthClaritySummary';
import { readAutoRepairSummary } from '../dataHealth/autoRepairOrchestrator';
import { buildEffectiveVolumeSummary, evaluateEffectiveSet } from '../engines/effectiveSetEngine';
import { EFFECTIVE_SET_EXPLANATION_REASON_LABELS } from '../engines/effectiveSetExplanationEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../engines/e1rmEngine';
import { buildHistoryCalendarSummary } from '../engines/historyCalendarSummary';
import type { ProgressTrendDirection } from '../engines/trainingDecisionTypes';
import {
  buildTrainingDecisionFromCleanInput,
  createCleanTrainingDecisionInput,
} from '../engines/trainingDecisionCleanInput';
import { buildCleanAppDataView } from '../dataHealth/cleanAppDataView';
import { hasInvalidExerciseIdentity } from '../engines/replacementEngine';
import { detectExercisePlateau } from '../engines/plateauDetectionEngine';
import { buildPainPatterns } from '../engines/painPatternEngine';
import { buildSessionQualityResult } from '../engines/sessionQualityEngine';
import { buildSessionComposition } from '../engines/sessionCompositionEngine';
import type { TrainingIntelligenceSummary } from '../engines/trainingIntelligenceSummaryEngine';
import {
  classNames,
  completedSets,
  number,
  setVolume,
  todayKey,
} from '../engines/engineUtils';
import { filterAnalyticsHistory, getSessionHistorySortKey, listSessionHistory, type SessionHistoryFilter } from '../engines/sessionHistoryEngine';
import { markSessionEdited, sessionEditFeedbackMessage, updateSessionSet, validateSessionEdit, type SessionEditResult } from '../engines/sessionEditEngine';
import { buildSessionDetailSummary, groupSessionSetsByType, type SessionSetEntry } from '../engines/sessionDetailSummaryEngine';
import {
  addCalendarMonths,
  buildTrainingCalendar,
  buildTrainingCalendarMonthRange,
  clampCalendarMonth,
  getInitialCalendarMonth,
  getSessionCalendarDate,
  resolveCalendarSelectedDate,
} from '../engines/trainingCalendarEngine';
import type { CoachAutomationSummary } from '../engines/enginePipeline';
import type { CoachAction } from '../engines/coachActionEngine';
import type { RecordUserFacing } from '../engines/trainingDecisionTypes';
import { buildCoachActionListViewModel } from '../presenters/coachActionPresenter';
import { buildDataHealthViewModel, type DataHealthActionView } from '../presenters/dataHealthPresenter';
import {
  formatDataFlag,
  formatExerciseName,
  formatMuscleName,
  formatPersonalRecordQuality,
  formatRirLabel,
  formatSessionVolumeLabel,
  formatSetType,
  formatSkippedReason,
  formatTemplateName,
  formatTechniqueQuality,
} from '../i18n/formatters';
import { convertKgToDisplayWeight, formatTrainingVolume, formatWeight, parseDisplayWeightToKg } from '../engines/unitConversionEngine';
import type {
  AppData,
  PersonalRecord,
  SessionEditAffectedStat,
  SessionDataFlag,
  SessionEditType,
  SupportExerciseLog,
  TechniqueQuality,
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
import { CoachActionList } from '../ui/CoachActionList';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { GlassCard } from '../uiOs/primitives/GlassCard';
import { ActionButton as UiOsActionButton } from '../uiOs/primitives/ActionButton';
import { DataHealthClarityPanel } from '../uiOs/dataHealth/DataHealthClarityPanel';
import { HistoryDaySummaryCard, type HistoryDaySessionItem } from '../uiOs/history/HistoryDaySummaryCard';
import { HistoryFrequencySummary } from '../uiOs/history/HistoryFrequencySummary';
import { PrErmQuickAccessCards } from '../uiOs/history/PrErmQuickAccessCards';
import { RecentTrainingTimeline } from '../uiOs/history/RecentTrainingTimeline';
import { TrainingFrequencyCalendar } from '../uiOs/history/TrainingFrequencyCalendar';
import { EffectiveSetsVolumeCard } from '../uiOs/progress/EffectiveSetsVolumeCard';
import { ProgressInsightHero } from '../uiOs/progress/ProgressInsightHero';
import { ReadinessPressureCard } from '../uiOs/progress/ReadinessPressureCard';
import { StrengthTrendCards } from '../uiOs/progress/StrengthTrendCards';
import { WeeklyProgressionRecommendationCard } from '../uiOs/progress/WeeklyProgressionRecommendationCard';
import { RecordOsOverview, RecordTimelineCard } from '../uiOs/records/RecordOsCards';
import {
  PostWorkoutNextTimeRecommendationCard,
  shouldShowPostWorkoutNextTimeRecommendation,
} from '../uiOs/records/PostWorkoutNextTimeRecommendationCard';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export interface RecordViewProps {
  data: AppData;
  unitSettings: UnitSettings;
  coachAutomationSummary?: CoachAutomationSummary;
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  coachActions?: CoachAction[];
  weeklyPrescription: WeeklyPrescription;
  bodyWeightInput: string;
  setBodyWeightInput: React.Dispatch<React.SetStateAction<string>>;
  onSaveBodyWeight: () => void;
  onDeleteSession: (sessionId: string) => SessionEditResult;
  onMarkSessionDataFlag: (sessionId: string, dataFlag: SessionDataFlag) => SessionEditResult;
  onEditSession?: (session: TrainingSession) => SessionEditResult;
  onOperationFeedback?: (message: string, tone?: 'success' | 'warning' | 'danger' | 'info') => void;
  onUpdateUnitSettings: (updates: Partial<UnitSettings>) => void;
  onRestoreData: (data: AppData) => void;
  onApplyProgramAdjustmentDraft?: unknown;
  onRollbackProgramAdjustment?: unknown;
  onDataHealthAction?: (action: DataHealthActionView) => void;
  onCoachAction?: (action: CoachAction) => void;
  onDismissCoachAction?: (action: CoachAction) => void;
  onStartTraining?: () => void;
  initialSection?: RecordSectionTarget;
  selectedSessionId?: string;
  selectedDate?: string;
  postWorkoutNextTimeRecommendation?: RecordUserFacing | null;
  surfaceMode?: 'history' | 'progress';
}

type RecordSectionId = 'calendar' | 'list' | 'pr' | 'stats' | 'data';
type RecordSectionTarget = RecordSectionId | 'history' | 'dashboard';
type PrSetFilter = 'all' | 'no_pain' | 'work_sets';
type PendingRecordAction =
  | { type: 'delete'; sessionId: string }
  | { type: 'flag'; sessionId: string; dataFlag: SessionDataFlag }
  | { type: 'edit'; session: TrainingSession }
  | { type: 'cancel-edit' };

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

const dataFlagOptions: Array<{ id: SessionDataFlag; label: string }> = [
  { id: 'normal', label: formatDataFlag('normal') },
  { id: 'test', label: formatDataFlag('test') },
  { id: 'excluded', label: formatDataFlag('excluded') },
];

const prFilterOptions: Array<{ id: PrSetFilter; label: string }> = [
  { id: 'all', label: '全部记录' },
  { id: 'no_pain', label: '排除不适' },
  { id: 'work_sets', label: '仅正式组' },
];

const recordDarkDescendantOverrides =
  '[&_.border-slate-200]:border-white/10 [&_.bg-stone-50]:bg-white/[0.05] [&_.bg-white]:bg-white/[0.06] [&_.bg-emerald-50]:bg-emerald-400/10 [&_.bg-amber-50]:bg-amber-400/10 [&_.bg-rose-50]:bg-rose-400/10 [&_.text-slate-950]:text-white [&_.text-slate-900]:text-white [&_.text-slate-700]:text-white/72 [&_.text-slate-600]:text-white/60 [&_.text-slate-500]:text-white/45';

const normalizeSection = (section?: RecordSectionTarget): RecordSectionId => {
  if (section === 'history') return 'list';
  if (section === 'dashboard') return 'stats';
  if (section === 'list' || section === 'pr' || section === 'stats' || section === 'data') return section;
  return 'calendar';
};

const getSessionTitle = (session: TrainingSession) =>
  session.templateId ? formatTemplateName(session.templateId, '未命名训练') : formatTemplateName(session.templateName || session.focus, '未命名训练');

const formatCalendarSessionTitle = (session: { title?: string; templateName?: string }) =>
  formatTemplateName(session.templateName || session.title, '未命名训练');

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

const supportLogStatusLabel = (log: SupportExerciseLog) => {
  const planned = Math.max(0, number(log.plannedSets));
  const completed = Math.min(Math.max(0, number(log.completedSets)), planned);
  if (log.skippedReason && completed <= 0) return '\u5df2\u8df3\u8fc7';
  if (log.skippedReason) return '\u90e8\u5206\u5b8c\u6210';
  if (planned > 0 && completed >= planned) return '\u5df2\u5b8c\u6210';
  if (completed > 0) return '\u90e8\u5206\u5b8c\u6210';
  return '\u672a\u5f00\u59cb';
};

const editFieldLabels: Record<string, string> = {
  sets: '正式组',
  warmupSets: '热身组',
  dataFlag: '数据状态',
  weight: '重量',
  reps: '次数',
  rir: 'RIR',
  techniqueQuality: '动作质量',
  painFlag: '不适标记',
  note: '备注',
};

const editTypeLabels: Record<SessionEditType, string> = {
  working_set: '修改正式组',
  warmup_set: '修改热身组',
  data_flag: '修改数据状态',
  note: '修改备注',
  mixed: '多项修正',
};

const affectedStatLabels: Record<SessionEditAffectedStat, string> = {
  volume: '总量',
  effectiveSet: '有效组',
  PR: 'PR',
  e1RM: 'e1RM',
  calendar: '日历',
  sessionQuality: '训练质量',
  none: '不影响 PR、e1RM 和有效组',
};

const formatEditTimestamp = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const date = parsed.toISOString().slice(0, 10);
  const time = parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
};

const formatEditedFields = (fields: string[] = []) =>
  fields.map((field) => editFieldLabels[field] || '修正内容').filter((field, index, items) => items.indexOf(field) === index).join('、') || '修正内容';

const formatAffectedStats = (stats: SessionEditAffectedStat[] = []) =>
  (stats.length ? stats : (['none'] as SessionEditAffectedStat[]))
    .map((stat) => affectedStatLabels[stat] || '统计')
    .filter((stat, index, items) => items.indexOf(stat) === index)
    .join('、');

const inferEditTypeFromFields = (fields: string[] = []): SessionEditType => {
  const fieldSet = new Set(fields);
  if (fieldSet.has('dataFlag')) return fieldSet.size > 1 ? 'mixed' : 'data_flag';
  if (fieldSet.has('sets')) return fieldSet.has('warmupSets') ? 'mixed' : 'working_set';
  if (fieldSet.has('warmupSets')) return 'warmup_set';
  if (fieldSet.has('note')) return 'note';
  return 'mixed';
};

const formatEditType = (item: NonNullable<TrainingSession['editHistory']>[number]) =>
  editTypeLabels[item.editType || inferEditTypeFromFields(item.editedFields || item.fields || [])] || '多项修正';

const formatEditSummary = (item: NonNullable<TrainingSession['editHistory']>[number]) => {
  if (item.beforeSummaryText || item.afterSummaryText) {
    return `${item.beforeSummaryText || '修正前未记录'} → ${item.afterSummaryText || '修正后未记录'}`;
  }
  if (item.beforeSummary && item.afterSummary) {
    return `正式组 ${item.beforeSummary.completedWorkingSets} → ${item.afterSummary.completedWorkingSets}，有效组 ${item.beforeSummary.effectiveSets} → ${item.afterSummary.effectiveSets}，总量 ${item.beforeSummary.workingVolume}kg → ${item.afterSummary.workingVolume}kg`;
  }
  return '已记录修正摘要';
};

const sessionHasPain = (session: TrainingSession) =>
  (session.exercises || []).some((exercise) => Array.isArray(exercise.sets) && exercise.sets.some((set) => Boolean(set.painFlag)));

const sessionNotes = (session: TrainingSession) =>
  groupSessionSetsByType(session).exerciseGroups.flatMap((group) =>
    [...group.warmupSets, ...group.workingSets, ...group.uncategorizedSets]
      .filter((entry) => entry.set.note)
      .map((entry, index) => ({
        key: `${session.id}-${group.exerciseId}-${entry.set.id || index}`,
        exerciseName: formatExerciseName(group.exercise),
        setLabel: `${entry.category === 'warmup' ? '热身组' : entry.category === 'working' ? '正式组' : '未分类组'} ${index + 1}`,
        note: entry.set.note || '',
      })),
  );

const formatPrValue = (record: PersonalRecord, unitSettings: UnitSettings) => {
  if (record.metric === 'volume') return formatTrainingVolume(record.raw ?? record.value, unitSettings);
  if (record.metric === 'max_weight' || record.metric === 'estimated_1rm') return formatWeight(record.raw ?? record.value, unitSettings);
  return record.displayValue || String(record.value);
};

const isDateWithinDays = (dateKey: string | undefined, today: string, days: number) => {
  if (!dateKey) return false;
  const dateTime = new Date(`${dateKey}T00:00:00`).getTime();
  const todayTime = new Date(`${today}T00:00:00`).getTime();
  if (!Number.isFinite(dateTime) || !Number.isFinite(todayTime)) return false;
  const deltaDays = Math.round((todayTime - dateTime) / 86400000);
  return deltaDays >= 0 && deltaDays <= days;
};

const isRepairDataHealthAction = (action?: DataHealthActionView) =>
  action?.type === 'repair_legacy_display_weights';

export const formatRecordSetWeightForDisplay = (set: TrainingSetLog, unitSettings: UnitSettings) => {
  if (Number.isFinite(Number(set.actualWeightKg))) return formatWeight(set.actualWeightKg, unitSettings);
  if (set.displayWeight !== undefined && (set.displayUnit === 'kg' || set.displayUnit === 'lb')) {
    return `${number(set.displayWeight)}${set.displayUnit}（需要复核）`;
  }
  if (number(set.weight) > 0) return `${formatWeight(set.weight, unitSettings)}（需要复核）`;
  return '重量需要复核';
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
  coachAutomationSummary,
  trainingIntelligenceSummary,
  coachActions,
  onDeleteSession,
  onMarkSessionDataFlag,
  onEditSession,
  onOperationFeedback,
  onDataHealthAction,
  onCoachAction,
  onDismissCoachAction,
  onStartTraining,
  initialSection,
  selectedSessionId,
  selectedDate,
  postWorkoutNextTimeRecommendation,
  surfaceMode = 'history',
}: RecordViewProps) {
  const { resolvedTheme } = useUiTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const rawHistory = data.history || [];
  const initialCalendarMonth = getInitialCalendarMonth(rawHistory, selectedDate);
  const [activeSection, setActiveSection] = React.useState<RecordSectionId>(() => normalizeSection(initialSection));
  const [historyFilter, setHistoryFilter] = React.useState<SessionHistoryFilter>('all');
  const [calendarMonth, setCalendarMonth] = React.useState(initialCalendarMonth);
  const [selectedDateKey, setSelectedDateKey] = React.useState(() =>
    resolveCalendarSelectedDate(rawHistory, initialCalendarMonth, selectedDate, todayKey())
  );
  const [selectedSession, setSelectedSession] = React.useState<TrainingSession | null>(() =>
    selectedSessionId ? (data.history || []).find((session) => session.id === selectedSessionId) || null : null,
  );
  const [editDraft, setEditDraft] = React.useState<TrainingSession | null>(null);
  const [editError, setEditError] = React.useState('');
  const [pendingAction, setPendingAction] = React.useState<PendingRecordAction | null>(null);
  const [selectedPrExerciseId, setSelectedPrExerciseId] = React.useState('');
  const [prSetFilter, setPrSetFilter] = React.useState<PrSetFilter>('all');

  const analyticsHistory = React.useMemo(() => filterAnalyticsHistory(rawHistory), [rawHistory]);
  const dataHealth = coachAutomationSummary?.dataHealth;
  const dismissedDataHealthIssues = data.dismissedDataHealthIssues || data.settings?.dismissedDataHealthIssues || [];
  const dataHealthViewModel = React.useMemo(
    () =>
      dataHealth
        ? buildDataHealthViewModel(dataHealth, {
            dismissedIssues: dismissedDataHealthIssues,
            currentDate: todayKey(),
          })
        : null,
    [dataHealth, dismissedDataHealthIssues],
  );
  const recordCoachActionViewModel = React.useMemo(
    () => buildCoachActionListViewModel(coachActions || [], { surface: 'record' }),
    [coachActions],
  );
  const sortedHistory = React.useMemo(() => listSessionHistory(rawHistory, historyFilter), [rawHistory, historyFilter]);
  const calendarRange = React.useMemo(() => buildTrainingCalendarMonthRange(rawHistory), [rawHistory]);
  const calendar = React.useMemo(
    () =>
      buildTrainingCalendar(rawHistory, calendarMonth, {
        includeDataFlags: 'all',
        importedWorkouts: data.importedWorkoutSamples || [],
        includeExternalWorkouts: data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar !== false,
      }),
    [rawHistory, calendarMonth, data.importedWorkoutSamples, data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar],
  );
  const dataHealthIssueCount = (dataHealthViewModel?.primaryIssues.length || 0) + (dataHealthViewModel?.secondaryIssues.length || 0);
  const historyCalendarSummary = React.useMemo(
    () =>
      buildHistoryCalendarSummary({
        sessions: rawHistory,
        selectedDate: selectedDateKey,
        today: todayKey(),
        month: calendarMonth,
        dataHealthIssueCount,
        importedWorkouts: data.importedWorkoutSamples || [],
        includeExternalWorkouts: data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar !== false,
      }),
    [calendarMonth, data.importedWorkoutSamples, data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar, dataHealthIssueCount, rawHistory, selectedDateKey],
  );
  const prs = React.useMemo(() => buildPrs(analyticsHistory), [analyticsHistory]);
  const prDates = React.useMemo(() => new Set(prs.map((item) => item.date).filter(Boolean)), [prs]);
  const monthStats = React.useMemo(() => buildMonthStats(analyticsHistory, data.bodyWeights || []), [analyticsHistory, data.bodyWeights]);
  const effectiveSummary = React.useMemo(() => buildEffectiveVolumeSummary(analyticsHistory), [analyticsHistory]);
  const painPatterns = React.useMemo(() => buildPainPatterns(analyticsHistory), [analyticsHistory]);
  const painSessions = React.useMemo(() => analyticsHistory.filter(sessionHasPain), [analyticsHistory]);
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
  const selectedMonthHasRecords = calendar.days.some((day) => day.totalSessions > 0 || day.totalExternalWorkouts > 0);
  const previousCalendarMonth = clampCalendarMonth(addCalendarMonths(calendarMonth, -1), calendarRange);
  const nextCalendarMonth = clampCalendarMonth(addCalendarMonths(calendarMonth, 1), calendarRange);
  const canGoPreviousMonth = previousCalendarMonth !== calendarMonth;
  const canGoNextMonth = nextCalendarMonth !== calendarMonth;
  const selectCalendarMonth = React.useCallback(
    (month: string) => {
      const nextMonth = clampCalendarMonth(month, calendarRange);
      setCalendarMonth(nextMonth);
      setSelectedDateKey(resolveCalendarSelectedDate(rawHistory, nextMonth, undefined, todayKey()));
    },
    [calendarRange, rawHistory],
  );
  const goToTodayInCalendar = React.useCallback(() => {
    const today = todayKey();
    const nextMonth = clampCalendarMonth(today.slice(0, 7), calendarRange);
    setCalendarMonth(nextMonth);
    setSelectedDateKey(today);
  }, [calendarRange]);

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
    const clampedMonth = clampCalendarMonth(calendarMonth, calendarRange);
    if (clampedMonth !== calendarMonth) {
      setCalendarMonth(clampedMonth);
      setSelectedDateKey(resolveCalendarSelectedDate(rawHistory, clampedMonth, selectedDateKey, todayKey()));
    }
  }, [calendarMonth, calendarRange, rawHistory, selectedDateKey]);

  React.useEffect(() => {
    if (!calendar.days.length) return;
    if (!calendar.days.some((day) => day.date === selectedDateKey)) {
      setSelectedDateKey(resolveCalendarSelectedDate(rawHistory, calendar.month, selectedDateKey, todayKey()));
    }
  }, [calendar.days, calendar.month, rawHistory, selectedDateKey]);

  React.useEffect(() => {
    if (initialSection) setActiveSection(normalizeSection(initialSection));
    if (selectedDate) {
      setCalendarMonth(clampCalendarMonth(selectedDate.slice(0, 7), calendarRange));
      setSelectedDateKey(selectedDate);
      setActiveSection(normalizeSection(initialSection || 'calendar'));
    }
    if (selectedSessionId) {
      const next = rawHistory.find((session) => session.id === selectedSessionId) || null;
      setSelectedSession(next);
      setActiveSection(normalizeSection(initialSection || 'list'));
    }
  }, [initialSection, selectedDate, selectedSessionId, rawHistory, calendarRange]);

  React.useEffect(() => {
    if (!selectedSession) return;
    const current = rawHistory.find((session) => session.id === selectedSession.id) || null;
    if (!current) {
      setSelectedSession(null);
      setEditDraft(null);
      setEditError('');
      return;
    }
    if (!editDraft && current !== selectedSession) {
      setSelectedSession(current);
    }
  }, [rawHistory, selectedSession, editDraft]);

  const openSession = (sessionId: string) => {
    const session = rawHistory.find((item) => item.id === sessionId) || null;
    setSelectedSession(session);
  };

  const notifyRecordOperation = (message: string, tone: 'success' | 'warning' | 'danger' | 'info' = 'info') => {
    if (message) onOperationFeedback?.(message, tone);
  };

  const requestFlagChange = (sessionId: string, dataFlag: SessionDataFlag) => {
    setPendingAction({ type: 'flag', sessionId, dataFlag });
  };

  const startEditingSession = (session: TrainingSession) => {
    setEditDraft(JSON.parse(JSON.stringify(session)) as TrainingSession);
    setEditError('');
  };

  const cancelEditingSession = () => {
    if (editDraft && selectedSession && editDraft.id === selectedSession.id && JSON.stringify(editDraft) !== JSON.stringify(selectedSession)) {
      setPendingAction({ type: 'cancel-edit' });
      return;
    }
    setEditDraft(null);
    setEditError('');
  };

  const updateDraftSet = (exerciseId: string, setId: string, patch: Parameters<typeof updateSessionSet>[3]) => {
    setEditDraft((current) => (current ? updateSessionSet(current, exerciseId, setId, patch) : current));
  };

  const updateDraftDataFlag = (dataFlag: SessionDataFlag) => {
    setEditDraft((current) => (current ? { ...current, dataFlag } : current));
  };

  const requestSaveEdit = () => {
    if (!editDraft) return;
    const validation = validateSessionEdit(editDraft);
    if (!validation.valid) {
      setEditError('修正内容包含无效数值，请检查重量、次数和 RIR。');
      notifyRecordOperation('保存失败，请检查输入后重试。', 'danger');
      return;
    }
    const editedFields: string[] = [];
    if (JSON.stringify(selectedSession?.focusWarmupSetLogs || []) !== JSON.stringify(editDraft.focusWarmupSetLogs || [])) editedFields.push('warmupSets');
    if (JSON.stringify((selectedSession?.exercises || []).map((exercise) => exercise.sets)) !== JSON.stringify((editDraft.exercises || []).map((exercise) => exercise.sets))) {
      editedFields.push('sets');
    }
    if ((selectedSession?.dataFlag || 'normal') !== (editDraft.dataFlag || 'normal')) editedFields.push('dataFlag');
    if (!editedFields.length) {
      setEditError('');
      notifyRecordOperation('没有需要保存的修改。', 'info');
      return;
    }
    setPendingAction({
      type: 'edit',
      session: markSessionEdited(editDraft, editedFields, '历史训练详情修正', selectedSession || undefined, unitSettings),
    });
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      const result = onDeleteSession(pendingAction.sessionId);
      if (result.ok) {
        setSelectedSession(null);
        setEditDraft(null);
      }
    } else if (pendingAction.type === 'flag') {
      const result = onMarkSessionDataFlag(pendingAction.sessionId, pendingAction.dataFlag);
      if (result.ok && result.session) {
        setSelectedSession((current) => (current?.id === pendingAction.sessionId ? result.session || current : current));
        setEditDraft((current) => (current?.id === pendingAction.sessionId ? result.session || current : current));
      }
    } else if (pendingAction.type === 'cancel-edit') {
      setEditDraft(null);
      setEditError('');
      notifyRecordOperation('已放弃本次修改。', 'info');
    } else {
      const result = onEditSession?.(pendingAction.session) || { ok: false, changed: false, message: '保存失败，请检查输入后重试。' };
      if (result.ok && result.session) {
        setSelectedSession(result.session);
        setEditDraft(null);
        setEditError('');
      } else {
        setEditError(result.message || '保存失败，请检查输入后重试。');
        notifyRecordOperation(result.message || '保存失败，请检查输入后重试。', 'danger');
      }
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
  const progressStrengthTrendItems = React.useMemo(() => {
    const today = todayKey();
    const recentPrExerciseIds = new Set(prs.filter((item) => isDateWithinDays(item.date, today, 28)).map((item) => item.exerciseId));
    return historyCalendarSummary.prQuickAccessItems.slice(0, 4).map((item) => {
      const hasE1rm = item.e1rmLabel !== '暂无 e1RM';
      const hasPr = item.prLabel !== '暂无正式记录';
      const hasData = hasE1rm || hasPr || item.hasData;
      const trend: ProgressTrendDirection = !hasData ? 'unknown' : recentPrExerciseIds.has(item.exerciseId) ? 'improving' : 'stable';
      return {
        id: item.exerciseId,
        label: item.label,
        currentLabel: hasE1rm ? item.e1rmLabel : item.prLabel,
        bestLabel: hasPr ? item.prLabel : undefined,
        trend,
        explanation: hasData
          ? '使用现有 PR / e1RM 结果做只读解释；不会重新计算或改写历史。'
          : '暂无正式记录。继续训练并完成记录后再判断趋势。',
      };
    });
  }, [historyCalendarSummary.prQuickAccessItems, prs]);
  const cleanAppDataView = React.useMemo(() => buildCleanAppDataView(data), [data]);
  const progressClarity = React.useMemo(() => {
    const hasRecentPr = prs.some((item) => isDateWithinDays(item.date, todayKey(), 28));
    const hasAnyStrengthData = progressStrengthTrendItems.some((item) => item.trend !== 'unknown');
    const strengthTrend: ProgressTrendDirection = hasRecentPr ? 'improving' : hasAnyStrengthData ? 'stable' : 'unknown';
    const recoveryPressure = painPatterns.some((pattern) => pattern.suggestedAction === 'deload' || pattern.suggestedAction === 'seek_professional')
      ? 'recovery'
      : painSessions.length > 0 || effectiveSummary.effectiveSets >= 24 || effectiveSummary.completedSets >= 32
        ? 'high'
        : 'normal';
    return buildTrainingDecisionFromCleanInput(
      createCleanTrainingDecisionInput(cleanAppDataView, {
        template: data.templates[0] || ({ id: 'fallback', exercises: [] } as never),
        trainingMode: data.trainingMode,
      }),
      {
        progress: {
          strengthTrend,
          recoveryPressure,
          dataCoverageStatus:
            analyticsHistory.length >= 4 ? 'sufficient' : analyticsHistory.length >= 2 ? 'limited' : 'insufficient',
          effectiveSetSummary: effectiveSummary,
          volumeSummary: {
            thisMonthSessions: monthStats.monthSessions.length,
            recentFourWeekAverage: recentWeekAverage,
            completedSets: effectiveSummary.completedSets,
            painSessionCount: painSessions.length,
            monthVolumeLabel: formatTrainingVolume(monthStats.monthVolume, unitSettings),
          },
          strengthTrendItems: progressStrengthTrendItems,
        },
      },
    ).userFacing.progress!;
  }, [analyticsHistory.length, cleanAppDataView, data.templates, data.trainingMode, effectiveSummary, monthStats.monthSessions.length, monthStats.monthVolume, painPatterns, painSessions.length, progressStrengthTrendItems, prs, recentWeekAverage, unitSettings]);
  const weeklyProgressionRecommendation = React.useMemo(() => {
    const today = todayKey();
    return buildTrainingDecisionFromCleanInput(
      createCleanTrainingDecisionInput(cleanAppDataView, {
        template: data.templates[0] || ({ id: 'fallback', exercises: [] } as never),
        trainingMode: data.trainingMode,
      }),
      {
        plan: {
          trainingIntelligenceSummary,
          effectiveSetSummary: effectiveSummary,
          painPatterns,
          weekId: today,
        },
      },
    ).userFacing.plan!;
  }, [cleanAppDataView, data.templates, data.trainingMode, effectiveSummary, painPatterns, trainingIntelligenceSummary]);
  const dataHealthClarity = React.useMemo(
    () =>
      buildDataHealthClaritySummary({
        issues: [...(dataHealthViewModel?.primaryIssues || []), ...(dataHealthViewModel?.secondaryIssues || [])],
        dismissedIssueCount: dismissedDataHealthIssues.length,
        sourceOfTruthClear: true,
        backupStatus: dataHealthViewModel?.primaryIssues.some((issue) => /备份|backup/i.test(`${issue.id} ${issue.title} ${issue.userMessage}`))
          ? 'recommended'
          : 'ok',
        cloudCandidateEnabled: false,
        ownerScopeClear: true,
        schemaValidationClear: true,
      }),
    [dataHealthViewModel, dismissedDataHealthIssues.length],
  );
  const formatSessionSummaryDescription = (session: TrainingSession) => {
    const summary = buildSessionDetailSummary(session, unitSettings);
    return `${getSessionCalendarDate(session)} · ${formatSessionDuration(session)} · ${summary.completedWorkingSets}/${summary.plannedWorkingSets} 正式组 · ${summary.effectiveSets} 有效组 · ${summary.totalDisplayVolume}`;
  };

  const selectedHistoryDaySessions: HistoryDaySessionItem[] = (selectedCalendarDay?.sessions || []).map((session) => {
    const sourceSession = rawHistory.find((item) => item.id === session.sessionId);
    const summary = sourceSession ? buildSessionDetailSummary(sourceSession, unitSettings) : null;
    return {
      id: session.sessionId,
      title: (
        <span className="flex flex-wrap items-center gap-2">
          {formatCalendarSessionTitle(session)}
          {renderFlagBadge(session.dataFlag)}
          {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
        </span>
      ),
      description: summary
        ? `${formatCalendarSessionTitle(session)} · ${summary.completedWorkingSets} 组 · ${summary.effectiveSets} 有效组 · ${summary.totalDisplayVolume}`
        : formatCalendarSessionTitle(session),
      meta: sourceSession ? formatSessionTime(sourceSession) : session.startTime ? formatSessionTime({ startedAt: session.startTime } as TrainingSession) : undefined,
    };
  });

  const renderCalendar = () => (
    <div className="space-y-4" aria-label="History calendar-first surface">
      {!rawHistory.length ? (
        <EmptyState
          title="暂无训练记录"
          description="完成一次训练后，这里会自动显示训练日历和当天详情。"
          action={onStartTraining ? <ActionButton onClick={onStartTraining}>开始训练</ActionButton> : undefined}
        />
      ) : null}
      <HistoryFrequencySummary
        thisWeekTrainingDays={historyCalendarSummary.thisWeekTrainingDays}
        thisMonthTrainingDays={historyCalendarSummary.thisMonthTrainingDays}
        recentFourWeekAverage={historyCalendarSummary.recentFourWeekAverage}
        currentStreak={historyCalendarSummary.currentStreak}
        dataHealthHint={historyCalendarSummary.dataHealthHint}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <TrainingFrequencyCalendar
          month={calendar.month}
          days={historyCalendarSummary.calendarDays}
          canGoPreviousMonth={canGoPreviousMonth}
          canGoNextMonth={canGoNextMonth}
          onPreviousMonth={() => selectCalendarMonth(previousCalendarMonth)}
          onNextMonth={() => selectCalendarMonth(nextCalendarMonth)}
          onToday={goToTodayInCalendar}
          onSelectDate={setSelectedDateKey}
        />
        <HistoryDaySummaryCard
          summary={historyCalendarSummary.selectedDaySummary}
          sessions={selectedHistoryDaySessions}
          onOpenSession={openSession}
        />
      </div>
      <PrErmQuickAccessCards
        items={historyCalendarSummary.prQuickAccessItems}
        onSelectExercise={(exerciseId) => {
          setSelectedPrExerciseId(exerciseId);
          setActiveSection('pr');
        }}
      />
      <RecentTrainingTimeline
        sessions={historyCalendarSummary.recentSessions}
        getTitle={(session) => (
          <span className="flex flex-wrap items-center gap-2">
            {getSessionTitle(session)}
            {renderFlagBadge(session.dataFlag)}
            {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
            {sessionHasPain(session) ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
          </span>
        )}
        getDescription={formatSessionSummaryDescription}
        getMeta={formatSessionTime}
        onOpenSession={setSelectedSession}
      />
      <GlassCard as="section" padding="md" className="text-white" ariaLabel="数据健康提示">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white/55">数据健康提示</p>
            <p className="mt-1 text-sm text-white/45">
              {historyCalendarSummary.dataHealthHint}。这里只显示平静回看信号，完整数据健康说明保留在数据分区。
            </p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/50">
            不执行修复
          </span>
        </div>
      </GlassCard>
    </div>
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
            <RecordTimelineCard key={session.id}>
              <ListItem
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {getSessionTitle(session)}
                    {renderFlagBadge(session.dataFlag)}
                    {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
                    {sessionHasPain(session) ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
                  </span>
                }
                description={`已记录 · ${formatSessionSummaryDescription(session)}`}
                meta={formatSessionTime(session)}
                action={<ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>查看详情</ActionButton>}
              />
            </RecordTimelineCard>
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
            <MetricCard label="最佳单组" value={topSet ? `${formatRecordSetWeightForDisplay(topSet.set, unitSettings)} × ${topSet.set.reps}` : '数据不足'} />
          </div>

          <GlassCard as="section" padding="md" className="text-white" ariaLabel="PR e1RM clarity">
            <div className="text-sm font-semibold text-white">进步解读</div>
            <p className="mt-1 text-sm leading-6 text-white/60">
              PR / e1RM 只来自正常训练记录。有效组、训练量和恢复压力用于解释趋势，不会改变历史数据或重新计算规则。
            </p>
          </GlassCard>

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
                    title={`${formatRecordSetWeightForDisplay(item.set, unitSettings)} × ${item.set.reps}`}
                    description={`${getSessionCalendarDate(item.session)} · ${getSessionTitle(item.session)} · ${item.effective.confidence === 'high' ? '高置信' : '可参考'}`}
                    meta={`${item.set.rir === undefined || item.set.rir === '' ? '余力（RIR）未记录' : formatRirLabel(item.set.rir)} · ${formatTechniqueQuality(item.set.techniqueQuality || 'acceptable')}${item.set.painFlag ? ' · 有不适' : ''}`}
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
    const muscleRows = Object.entries(effectiveSummary.byMuscle)
      .map(([muscle, row]) => ({ muscle, ...row }))
      .sort((left, right) => right.weightedEffectiveSets - left.weightedEffectiveSets)
      .slice(0, 8);

    return (
      <PageSection title="统计" description="只统计正常训练数据。测试和排除数据不会进入频率、有效组、肌群分布和不适统计。">
        <div className="space-y-3">
          {surfaceMode === 'progress' ? (
            <WeeklyProgressionRecommendationCard recommendation={weeklyProgressionRecommendation} surface="dark" />
          ) : null}
          {!analyticsHistory.length ? (
            <EmptyState title="统计数据不足" description="完成训练后，这里会显示频率、有效组、肌群分布和不适趋势。" />
          ) : (
            <>
            <ProgressInsightHero summary={progressClarity} />
            <StrengthTrendCards
              items={progressClarity.strengthTrendItems}
              onSelectItem={(exerciseId) => {
                setSelectedPrExerciseId(exerciseId);
                setActiveSection('pr');
              }}
            />
            <ReadinessPressureCard summary={progressClarity} />
            <EffectiveSetsVolumeCard summary={progressClarity} />

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
                          <span>{formatMuscleName(row.muscle)}</span>
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
                      description={`${getSessionCalendarDate(session)} · 有不适组，建议回看动作质量和备注`}
                      action={<ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>详情</ActionButton>}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">正常训练数据中暂无不适标记。</div>
              )}
            </Card>
            </>
          )}
        </div>
      </PageSection>
    );
  };

  const renderData = () => {
    const normalCount = rawHistory.filter((session) => !session.dataFlag || session.dataFlag === 'normal').length;
    const testCount = rawHistory.filter((session) => session.dataFlag === 'test').length;
    const excludedCount = rawHistory.filter((session) => session.dataFlag === 'excluded').length;
    const dataRows = [...rawHistory].sort((left, right) => getSessionHistorySortKey(right).localeCompare(getSessionHistorySortKey(left)));
    const visibleIssues = dataHealthViewModel?.primaryIssues || [];
    const hiddenIssues = dataHealthViewModel?.secondaryIssues || [];
    const issueViews = [...visibleIssues, ...hiddenIssues];
    const renderIssueActions = (issueId: string) => {
      const issue = issueViews.find((item) => item.id === issueId);
      if (!issue || !onDataHealthAction) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {issue.action && issue.action.type !== 'none' && !isRepairDataHealthAction(issue.action) ? (
            <UiOsActionButton type="button" size="sm" variant="secondary" onClick={() => onDataHealthAction(issue.action!)}>
              {issue.action.label}
            </UiOsActionButton>
          ) : null}
          {issue.dismissAction ? (
            <UiOsActionButton type="button" size="sm" variant="ghost" onClick={() => onDataHealthAction(issue.dismissAction!)}>
              {issue.dismissAction.label}
            </UiOsActionButton>
          ) : null}
        </div>
      );
    };

    return (
      <PageSection title="训练记录数据" description="数据健康检查先给安全解释；这里仍只管理训练记录本身：删除、标记测试、恢复正常、排除统计。单位、健康数据和全局备份在“我的”页。">
        <DataHealthClarityPanel
          summary={dataHealthClarity}
          renderIssueActions={renderIssueActions}
          autoRepairSummary={readAutoRepairSummary(data)}
        />
        {recordCoachActionViewModel.pending.length ? (
          <div className="mb-3">
            <CoachActionList
              title="记录相关教练建议"
              description="只显示和训练记录、数据健康相关的建议；点击后会打开对应记录或数据分区。"
              viewModel={recordCoachActionViewModel}
              compact
              onAction={onCoachAction}
              onDismiss={onDismissCoachAction}
              onDetail={onCoachAction}
            />
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="正常记录" value={`${normalCount}`} tone="emerald" />
          <MetricCard label="测试记录" value={`${testCount}`} tone="amber" />
          <MetricCard label="排除记录" value={`${excludedCount}`} />
        </div>
        {!dataRows.length ? (
          <EmptyState title="暂无训练记录" description="完成一次训练后，可以在这里管理该训练是否参与统计。" />
        ) : (
          <div className="mt-3 space-y-2">
            {dataRows.map((session) => {
              const summary = buildSessionDetailSummary(session, unitSettings);
              return (
                <ListItem
                  key={session.id}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {getSessionTitle(session)}
                      {renderFlagBadge(session.dataFlag)}
                    </span>
                  }
                  description={`${getSessionCalendarDate(session)} · ${summary.completedWorkingSets}/${summary.plannedWorkingSets} 正式组 · ${summary.totalDisplayVolume}`}
                  action={
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>详情</ActionButton>
                      <ActionButton size="sm" variant="secondary" onClick={() => requestFlagChange(session.id, 'test')}>标记测试</ActionButton>
                      <ActionButton size="sm" variant="ghost" onClick={() => requestFlagChange(session.id, 'normal')}>恢复正常</ActionButton>
                      <ActionButton size="sm" variant="danger" onClick={() => setPendingAction({ type: 'delete', sessionId: session.id })}>删除</ActionButton>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </PageSection>
    );
  };

  const renderSetEditor = (entry: SessionSetEntry, index: number) => {
    const { exerciseId, set, category } = entry;
    const setId = set.id || String(index);
    const displayWeight = convertKgToDisplayWeight(set.actualWeightKg ?? set.weight, unitSettings.weightUnit);
    const isWarmup = category === 'warmup';
    return (
      <div key={set.id || `${exerciseId}-${index}`} className="grid gap-2 rounded-lg bg-stone-50 p-3 text-sm md:grid-cols-[1fr_1fr_1fr_1fr]">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">重量（{unitSettings.weightUnit}）</span>
          <input
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950"
            inputMode="decimal"
            value={displayWeight}
            onChange={(event) =>
              updateDraftSet(exerciseId, setId, {
                weightKg: parseDisplayWeightToKg(event.target.value, unitSettings.weightUnit),
                displayWeight: Math.max(0, number(event.target.value)),
                displayUnit: unitSettings.weightUnit,
              })
            }
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">次数</span>
          <input
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950"
            inputMode="numeric"
            value={set.reps}
            onChange={(event) => updateDraftSet(exerciseId, setId, { reps: number(event.target.value) })}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">余力（RIR）</span>
          <input
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950"
            inputMode="numeric"
            value={set.rir ?? ''}
            onChange={(event) => updateDraftSet(exerciseId, setId, { rir: event.target.value })}
          />
        </label>
        {!isWarmup ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-500">动作质量</span>
              <select
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950"
                value={set.techniqueQuality || 'acceptable'}
                onChange={(event) => updateDraftSet(exerciseId, setId, { techniqueQuality: event.target.value as TechniqueQuality })}
              >
                <option value="good">良好</option>
                <option value="acceptable">可接受</option>
                <option value="poor">较差</option>
              </select>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(set.painFlag)}
                onChange={(event) => updateDraftSet(exerciseId, setId, { painFlag: event.target.checked })}
              />
              <span className="text-sm font-semibold text-slate-700">本组有不适</span>
            </label>
          </>
        ) : null}
        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-slate-500">备注</span>
          <input
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-950"
            value={set.note || ''}
            onChange={(event) => updateDraftSet(exerciseId, setId, { note: event.target.value })}
          />
        </label>
      </div>
    );
  };

  const renderSessionDrawer = () => {
    const session = editDraft && selectedSession && editDraft.id === selectedSession.id ? editDraft : selectedSession;
    if (!session) return null;
    const isEditing = Boolean(editDraft && selectedSession && editDraft.id === selectedSession.id);
    const notes = sessionNotes(session);
    const summary = buildSessionDetailSummary(session, unitSettings);
    const composition = buildSessionComposition(session);
    const effective = summary.effectiveSummary;
    const sessionQuality = buildSessionQualityResult({
      session,
      painPatterns,
      loadFeedback: session.loadFeedback || [],
    });
    const effectiveExplanation = summary.effectiveSetExplanation;
    const visibleEffectiveCountedSets = effectiveExplanation.countedSets.slice(0, 3);
    const visibleEffectiveExcludedSets = effectiveExplanation.excludedSets.slice(0, 6);
    const editHistory = session.editHistory || [];
    const latestEdit = editHistory.at(-1);
    const visiblePostWorkoutNextTimeRecommendation = shouldShowPostWorkoutNextTimeRecommendation(
      session,
      postWorkoutNextTimeRecommendation,
      isEditing,
    )
      ? postWorkoutNextTimeRecommendation
      : null;
    const qualityItems = [...sessionQuality.positives, ...sessionQuality.issues].slice(0, 3);
    const plateauResults = summary.groupedSets.exerciseGroups
      .map((group) => getExerciseRecordPoolId(group.exercise))
      .filter((exerciseId, index, items) => exerciseId && items.indexOf(exerciseId) === index)
      .slice(0, 3)
      .map((exerciseId) =>
        detectExercisePlateau({
          exerciseId,
          history: analyticsHistory,
          e1rmProfile: buildE1RMProfile(analyticsHistory, exerciseId),
          effectiveSetSummary: effectiveSummary,
          loadFeedback: analyticsHistory.flatMap((item) => item.loadFeedback || []),
          painPatterns,
        }),
      )
      .filter((item) => item.status !== 'none' && item.status !== 'insufficient_data');
    const primaryPlateau = plateauResults[0];

      const isCompletedSummarySet = (set: TrainingSetLog) =>
        set.done === true && number(set.actualWeightKg ?? set.weight) > 0 && number(set.reps) > 0;
      const isIncompleteSummarySet = (set: TrainingSetLog) => !isCompletedSummarySet(set);

      const renderSetLine = (entry: SessionSetEntry, index: number) => {
        const set = entry.set;
        const plannedText = `${formatRecordSetWeightForDisplay(set, unitSettings)} × ${set.reps}${set.rir !== undefined && set.rir !== '' ? ` / ${formatRirLabel(set.rir)}` : ''}`;
        const label = entry.category === 'warmup' ? formatSetType('warmup') : entry.category === 'working' ? formatSetType('working') : '未分类组';
        const identityWarning = hasInvalidExerciseIdentity(entry.exercise) || set.identityInvalid ? ' / 动作身份需要检查' : '';
        if (entry.category === 'working' && isIncompleteSummarySet(set)) {
          return (
            <div key={set.id || `${entry.exerciseId}-${entry.category}-${index}`} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
              未完成 · 计划 {plannedText}
              {identityWarning}
              {set.note ? ` / ${set.note}` : ''}
            </div>
          );
        }
      return (
        <div key={set.id || `${entry.exerciseId}-${entry.category}-${index}`} className="rounded-md bg-stone-50 px-3 py-2">
          {label} {index + 1}：{formatRecordSetWeightForDisplay(set, unitSettings)} × {set.reps}
          {' / '}
            {formatRirLabel(set.rir)}
            {entry.category !== 'warmup' && set.techniqueQuality ? ` / ${formatTechniqueQuality(set.techniqueQuality)}` : ''}
            {entry.category !== 'warmup' && set.painFlag ? ' / 有不适' : ''}
            {identityWarning}
            {set.note ? ` / ${set.note}` : ''}
          </div>
        );
      };

    const renderSetSection = (title: string, entries: SessionSetEntry[]) =>
      entries.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">{title}</div>
          {entries.map((entry, index) => (isEditing ? renderSetEditor(entry, index) : renderSetLine(entry, index)))}
        </div>
      ) : null;

    return (
      <Drawer
        open={Boolean(selectedSession)}
        title={isEditing ? '修正记录' : '训练详情'}
        onClose={() => {
          setSelectedSession(null);
          setEditDraft(null);
          setEditError('');
        }}
      >
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-slate-950">{getSessionTitle(session)}</div>
              {renderFlagBadge(session.dataFlag)}
              {session.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
              {sessionHasPain(session) ? <StatusBadge tone="amber">有不适</StatusBadge> : null}
              {session.editedAt ? <StatusBadge tone="amber">已修正</StatusBadge> : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">{getSessionCalendarDate(session)} · {formatSessionTime(session)} · {formatSessionDuration(session)}</div>
            {latestEdit ? (
              <div className="mt-2 text-sm font-semibold text-amber-700">
                最近修正：{formatEditTimestamp(latestEdit.editedAt)}
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricCard label="完成正式组" value={`${summary.completedWorkingSets}/${summary.plannedWorkingSets}`} helper="只统计已完成正式组" />
              <MetricCard label="有效组" value={`${summary.effectiveSets}`} helper="按正式组有效条件计算" tone="emerald" />
              <MetricCard label={formatSessionVolumeLabel()} value={summary.totalDisplayVolume} helper="正式组训练量" />
              <MetricCard label="未完成组" value={`${summary.incompleteSets}`} helper={summary.incompleteSets ? '不计入完成、总量和有效组' : '无'} tone={summary.incompleteSets ? 'amber' : 'slate'} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MetricCard label="热身组" value={`${summary.warmupSets}/${summary.plannedWarmupSets}`} helper="不计入正式组" />
              <MetricCard label="热身量" value={formatTrainingVolume(summary.warmupVolumeKg, unitSettings)} helper="只统计已完成热身组" />
            </div>
              {summary.effectiveSets < summary.completedWorkingSets && effectiveExplanation.excludedSetCount > 0 ? (
              <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                <summary className="cursor-pointer font-semibold">有效组为什么？</summary>
                <div className="mt-2 space-y-1">
                  <div>{effectiveExplanation.summary}</div>
                  {visibleEffectiveCountedSets.length ? (
                    <div className="font-semibold text-emerald-800">已计入</div>
                  ) : null}
                  {visibleEffectiveCountedSets.map((item) => (
                    <div key={`counted-${item.exerciseName}-${item.setIndex}`}>
                      {item.exerciseName} 第 {item.setIndex} 组：{item.reason}
                    </div>
                  ))}
                  {visibleEffectiveExcludedSets.length ? (
                    <div className="font-semibold text-amber-900">未计入</div>
                  ) : null}
                  {visibleEffectiveExcludedSets.map((item) => (
                    <div key={`${item.exerciseName}-${item.setIndex}-${item.reasonCode}`}>
                      {item.exerciseName} 第 {item.setIndex} 组：{item.reason || EFFECTIVE_SET_EXPLANATION_REASON_LABELS[item.reasonCode]}
                    </div>
                  ))}
                  {effectiveExplanation.excludedSetCount > visibleEffectiveExcludedSets.length ? (
                    <div>另有 {effectiveExplanation.excludedSetCount - visibleEffectiveExcludedSets.length} 组未计入。</div>
                  ) : null}
                </div>
              </details>
              ) : null}
              {summary.earlyEndSummary ? (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  {summary.earlyEndSummary}
                </div>
              ) : null}
              {summary.identityIssueCount > 0 ? (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  部分动作身份需要检查，相关组不会进入 PR、e1RM 或有效组。
                </div>
              ) : null}
              <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-950">训练构成：</span>
              主训练 {composition.mainShare}% / 纠偏 {composition.correctionShare}% / 功能 {composition.functionalShare}%。
              {composition.summary}
            </div>
            {summary.excludedFromStats ? (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                这次训练不参与默认统计。你仍然可以查看、修正或恢复它。
              </div>
            ) : null}
            {editHistory.length ? (
              <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                <summary className="cursor-pointer font-semibold text-slate-950">查看修正记录</summary>
                <div className="mt-2 space-y-2">
                  {editHistory.slice(-5).reverse().map((item) => (
                    <div key={item.id || `${item.editedAt}-${formatEditedFields(item.changedFields || item.editedFields || item.fields)}`} className="rounded-lg bg-stone-50 px-3 py-2">
                      <div className="font-semibold text-slate-950">{formatEditTimestamp(item.editedAt)}</div>
                      <div>类型：{formatEditType(item)}</div>
                      <div>字段：{formatEditedFields(item.changedFields || item.editedFields || item.fields)}</div>
                      <div>修改：{formatEditSummary(item)}</div>
                      <div>影响：{formatAffectedStats(item.affectedStats)}</div>
                      {item.reason || item.note ? <div>原因：{item.reason || item.note}</div> : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {isEditing ? (
              <>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  保存后会重新计算 PR、e1RM、有效组和统计；取消编辑不会保存。
                </div>
                <label className="mt-3 grid gap-1">
                  <span className="text-xs font-semibold text-slate-500">数据标记</span>
                  <select
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950"
                    value={session.dataFlag || 'normal'}
                    onChange={(event) => updateDraftDataFlag(event.target.value as SessionDataFlag)}
                  >
                    {dataFlagOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </Card>

          {visiblePostWorkoutNextTimeRecommendation ? (
            <PostWorkoutNextTimeRecommendationCard
              recommendation={visiblePostWorkoutNextTimeRecommendation}
              unitSettings={unitSettings}
            />
          ) : null}

          <PageSection title="训练质量">
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
              {qualityItems.length ? (
                <div className="space-y-2">
                  {qualityItems.map((item) => (
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
              {primaryPlateau ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  <span className="font-semibold">平台期提示：</span>
                  {primaryPlateau.summary}
                </div>
              ) : null}
            </Card>
          </PageSection>

          <PageSection title="表现概览">
            <Card>
              <div className="grid gap-2 md:grid-cols-4">
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
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">辅助完成组</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{summary.supportSetCount}</div>
                </div>
              </div>
            </Card>
          </PageSection>

          <PageSection title="动作记录">
            {summary.groupedSets.exerciseGroups.map((group) => {
              const exercise = group.exercise;
              const completedWorkingSets = group.workingSets.filter((entry) => isCompletedSummarySet(entry.set));
              const incompleteWorkingSets = group.workingSets.filter((entry) => isIncompleteSummarySet(entry.set));
              const exerciseNotStarted = group.workingSets.length > 0 && completedWorkingSets.length <= 0 && incompleteWorkingSets.length > 0;
              return (
                <Card key={`${session.id}-${exercise.id}`} className="space-y-2">
                  <div className="font-semibold text-slate-950">{formatExerciseName(exercise)}</div>
                  {exerciseNotStarted ? (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      {formatExerciseName(exercise)}：未完成
                    </div>
                  ) : null}
                  {exercise.originalExerciseId && exercise.actualExerciseId && exercise.originalExerciseId !== exercise.actualExerciseId ? (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      原计划：{formatExerciseName(exercise.originalExerciseId)} / 实际执行：{formatExerciseName(exercise.actualExerciseId)}
                    </div>
                  ) : null}
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    {group.warmupSets.length || group.workingSets.length || group.uncategorizedSets.length ? (
                      <>
                        {renderSetSection('热身组', group.warmupSets)}
                        {renderSetSection('已完成正式组', completedWorkingSets)}
                        {renderSetSection('未完成组', incompleteWorkingSets)}
                        {renderSetSection('未分类组', group.uncategorizedSets)}
                      </>
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
                  title={formatExerciseName({ id: log.exerciseId, name: log.exerciseName })}
                  description={`${supportLogStatusLabel(log)} · ${log.completedSets}/${log.plannedSets} 组${log.skippedReason ? ` · 跳过原因：${formatSkippedReason(log.skippedReason)}` : ''}`}
                  meta={`${log.blockType === 'correction' ? '纠偏' : '功能补丁'}：${supportLogStatusLabel(log)}`}
                />
              ))}
            </PageSection>
          ) : null}

          <PageSection title="备注">
            {notes.length ? (
              <div className="space-y-2">
                {notes.map((item) => (
                  <div key={item.key} className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-600">
                    <span className="font-semibold text-slate-950">{item.exerciseName} {item.setLabel}：</span>
                    {item.note}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">本次训练没有备注。</div>
            )}
          </PageSection>

          <PageSection title="操作">
            {editError ? <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{editError}</div> : null}
            <div className="grid gap-2 sm:grid-cols-4">
              {isEditing ? (
                <>
                  <ActionButton variant="primary" onClick={requestSaveEdit}>
                    保存修正
                  </ActionButton>
                  <ActionButton variant="secondary" onClick={cancelEditingSession}>
                    取消编辑
                  </ActionButton>
                </>
              ) : (
                <ActionButton variant="secondary" onClick={() => startEditingSession(session)}>
                  修正记录
                </ActionButton>
              )}
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
          title: '删除这次训练？',
          description: '删除后该训练不会参与日历、PR、e1RM、有效组和统计。建议先导出备份。',
          confirmText: '删除',
          cancelText: '取消',
          variant: 'danger' as const,
        }
      : pendingAction?.type === 'edit'
        ? {
            title: '保存修正？',
            description: sessionEditFeedbackMessage(pendingAction.session.editHistory?.at(-1)?.fields || []),
            confirmText: '保存修正',
            cancelText: '继续编辑',
            variant: 'warning' as const,
          }
        : pendingAction?.type === 'cancel-edit'
          ? {
              title: '放弃修正？',
              description: '当前修改不会保存。',
              confirmText: '放弃修改',
              cancelText: '继续编辑',
              variant: 'warning' as const,
            }
        : pendingAction?.dataFlag === 'normal'
        ? {
            title: '恢复为正常数据？',
            description: '恢复后这次训练会重新参与 PR、e1RM、有效组和统计。',
            confirmText: '恢复',
            cancelText: '取消',
            variant: 'warning' as const,
          }
        : pendingAction?.dataFlag === 'test'
          ? {
              title: '更改数据状态？',
              description: '测试或排除数据仍可查看，但不会参与训练统计。',
              confirmText: '确认更改',
              cancelText: '取消',
              variant: 'warning' as const,
            }
          : {
              title: '更改数据状态？',
              description: '测试或排除数据仍可查看，但不会参与训练统计。',
              confirmText: '确认更改',
              cancelText: '取消',
              variant: 'warning' as const,
            };

  return (
    <ResponsivePageLayout>
      <PageHeader
        eyebrow="记录"
        title="训练记录中心"
      />
      <div
        className={classNames('space-y-4', isDarkTheme ? recordDarkDescendantOverrides : '')}
        data-global-surface-sweep="record"
        data-record-detail-surface={resolvedTheme}
        data-theme-surface="record_detail_surface"
      >
        <RecordOsOverview>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-emerald-200">
                {surfaceMode === 'history' ? '训练频率记录' : '个人训练记录'}
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                {surfaceMode === 'history' ? '训练频率先看日历，再看 PR / e1RM' : '历史、进步和数据健康保持同一套记录来源'}
              </h2>
            </div>
            <div className="grid min-w-40 gap-2 text-sm">
              <div className="rounded-2xl bg-white/10 px-3 py-2">训练记录：{rawHistory.length} 次</div>
              <div className="rounded-2xl bg-white/10 px-3 py-2">正常统计：{analyticsHistory.length} 次</div>
            </div>
          </div>
        </RecordOsOverview>
        <SegmentedControl value={activeSection} options={recordSections} onChange={setActiveSection} ariaLabel="记录中心分区" />
        {activeSection === 'calendar' ? renderCalendar() : null}
        {activeSection === 'list' ? renderHistoryList() : null}
        {activeSection === 'pr' ? renderPr() : null}
        {activeSection === 'stats' ? renderStats() : null}
        {activeSection === 'data' ? renderData() : null}
      </div>
      {renderSessionDrawer()}
      {pendingAction ? (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          <ConfirmDialog
            title={pendingActionCopy.title}
            description={pendingActionCopy.description}
            confirmText={pendingActionCopy.confirmText}
            cancelText={pendingActionCopy.cancelText}
            variant={pendingActionCopy.variant}
            onCancel={() => setPendingAction(null)}
            onConfirm={confirmPendingAction}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
