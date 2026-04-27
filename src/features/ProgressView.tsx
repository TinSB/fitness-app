import React from 'react';
import { Activity, BarChart3, CalendarDays, Copy, Download, Save } from 'lucide-react';
import { EXERCISE_DISPLAY_NAMES } from '../data/exerciseLibrary';
import {
  CORE_TREND_EXERCISES,
  buildAdherenceReport,
  buildExerciseTrend,
  buildMuscleVolumeDashboard,
  buildMonthStats,
  buildPrs,
  buildRecentSessionBars,
  buildWeeklyReport,
  downloadText,
  makeCsv,
  trendStatus,
} from '../engines/analytics';
import { buildAdherenceAdjustment } from '../engines/adherenceAdjustmentEngine';
import { buildPainPatterns } from '../engines/painPatternEngine';
import { buildE1RMProfile } from '../engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../engines/effectiveSetEngine';
import { buildLoadFeedbackSummary } from '../engines/loadFeedbackEngine';
import { buildSessionSummaryExplanations } from '../engines/explainability/trainingExplainability';
import { buildWeeklyActionExplanation, buildWeeklyCoachReview } from '../engines/explainability/weeklyActionExplainability';
import { formatExplanationEvidence } from '../engines/explainability/evidenceExplainability';
import { formatExplanationItem } from '../engines/explainability/shared';
import { buildWeeklyActionRecommendations } from '../engines/weeklyCoachActionEngine';
import { classNames, formatDate, number, sessionCompletedSets, sessionVolume, todayKey } from '../engines/engineUtils';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildDeloadSignal } from '../engines/deloadSignalEngine';
import { filterAnalyticsHistory, listSessionHistory, type SessionHistoryFilter } from '../engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../engines/trainingCalendarEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import { formatWeight } from '../engines/unitConversionEngine';
import {
  formatAdherenceConfidence,
  formatAdjustmentChangeLabel,
  formatAdjustmentReviewStatus,
  formatAdjustmentRiskLevel,
  formatComplexityLevel,
  formatDayTemplateName,
  formatExerciseName,
  formatPainAction,
  formatPersonalRecordQuality,
  formatProgramTemplateName,
  formatSkippedReason,
  formatSupportDoseAdjustment,
  formatTechniqueQuality,
  formatWeeklyActionCategory,
  formatWeeklyActionPriority,
} from '../i18n/formatters';
import type { AdjustmentEffectReview, AppData, ProgramAdjustmentDiff, ProgramAdjustmentDraft, SessionDataFlag, TrainingSession, UnitSettings, WeeklyPrescription } from '../models/training-model';
import { ActionButton, Card, EmptyState, Page, SegmentedTabs, Stat, StatusBadge, WeeklyPrescriptionCard } from '../ui/common';
import { Term } from '../ui/Term';

export interface ProgressViewProps {
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
  onApplyProgramAdjustmentDraft: (draft: ProgramAdjustmentDraft) => void;
  onRollbackProgramAdjustment: (historyItemId: string) => void;
  onStartTraining?: () => void;
  initialSection?: ProgressSectionId;
  selectedSessionId?: string;
  selectedDate?: string;
}

type ProgressSectionId = 'dashboard' | 'calendar' | 'history' | 'pr' | 'data';

const progressSections: Array<{ id: ProgressSectionId; label: string; mobileLabel: string }> = [
  { id: 'calendar', label: '训练日历', mobileLabel: '日历' },
  { id: 'history', label: '历史训练', mobileLabel: '历史' },
  { id: 'dashboard', label: '统计', mobileLabel: '统计' },
  { id: 'pr', label: '个人记录 / PR', mobileLabel: 'PR' },
  { id: 'data', label: '数据管理', mobileLabel: '数据' },
];

const historyFilterOptions: Array<{ id: SessionHistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'normal', label: '正常数据' },
  { id: 'test', label: '测试数据' },
  { id: 'excluded', label: '排除数据' },
];

const dataFlagLabel = (flag?: SessionDataFlag) => {
  if (flag === 'test') return '测试';
  if (flag === 'excluded') return '排除';
  return '正常';
};

const formatSessionTime = (session?: Pick<TrainingSession, 'startedAt' | 'finishedAt'> | null) => {
  if (!session?.startedAt) return '未记录时间';
  const started = new Date(session.startedAt);
  if (Number.isNaN(started.getTime())) return '未记录时间';
  const startText = started.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (!session.finishedAt) return startText;
  const finished = new Date(session.finishedAt);
  if (Number.isNaN(finished.getTime())) return startText;
  return `${startText} - ${finished.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
};

const volumeStatusLabels = {
  low: '不足',
  near_target: '接近目标',
  on_target: '达标',
  high: '可能偏高',
} as const;

const volumeStatusClasses = {
  low: 'bg-amber-50 text-amber-800',
  near_target: 'bg-sky-50 text-sky-800',
  on_target: 'bg-emerald-50 text-emerald-800',
  high: 'bg-rose-50 text-rose-800',
} as const;

const e1rmMethodLabels = {
  median_recent: '近期中位数',
  weighted_recent_average: '近期加权平均',
  single_recent_low_confidence: '单次低置信参考',
} as const;

const actionPriorityClasses = {
  high: 'bg-rose-50 text-rose-800',
  medium: 'bg-amber-50 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
} as const;

const riskClasses = {
  low: 'bg-emerald-50 text-emerald-800',
  medium: 'bg-amber-50 text-amber-800',
  high: 'bg-rose-50 text-rose-800',
} as const;

const previewChangeLabels = {
  add_sets: '增加组数',
  remove_sets: '减少组数',
  add_new_exercise: '新增动作',
  swap_exercise: '替代动作',
  reduce_support: '减少辅助层',
  increase_support: '增加辅助层',
  keep: '维持',
} as const;

const adjustmentReviewTone = {
  too_early: 'bg-slate-100 text-slate-700',
  improved: 'bg-emerald-50 text-emerald-800',
  neutral: 'bg-sky-50 text-sky-800',
  worse: 'bg-rose-50 text-rose-800',
  insufficient_data: 'bg-amber-50 text-amber-800',
} as const;

const summarizeHistoryChanges = (item: {
  mainChangeSummary?: string;
  changes: Array<{ type: string; dayTemplateName?: string; dayTemplateId?: string; exerciseName?: string; exerciseId?: string; reason: string; skipped?: boolean }>;
}) =>
  item.mainChangeSummary ||
  item.changes
    .filter((change) => !change.skipped)
    .slice(0, 3)
    .map((change) => {
      if (change.type === 'add_new_exercise') {
        return `${formatDayTemplateName(change.dayTemplateName || change.dayTemplateId)} 新增 ${formatExerciseName(change.exerciseName || change.exerciseId)}`;
      }
      if (change.exerciseName || change.exerciseId) {
        return `${formatExerciseName(change.exerciseName || change.exerciseId)}：${formatAdjustmentChangeLabel(change.type)}`;
      }
      return change.reason;
    })
    .join(' / ') ||
  '本次没有自动落地的结构调整';

export function ProgressView({
  data,
  unitSettings,
  weeklyPrescription,
  bodyWeightInput,
  setBodyWeightInput,
  onSaveBodyWeight,
  onDeleteSession,
  onMarkSessionDataFlag,
  onUpdateUnitSettings,
  onRestoreData,
  onApplyProgramAdjustmentDraft,
  onRollbackProgramAdjustment,
  onStartTraining,
  initialSection,
  selectedSessionId: requestedSessionId,
  selectedDate,
}: ProgressViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = React.useState('');
  const rawHistory = data.history || [];
  const [activeProgressSection, setActiveProgressSection] = React.useState<ProgressSectionId>(initialSection || 'calendar');
  const [historyFilter, setHistoryFilter] = React.useState<SessionHistoryFilter>('all');
  const [showNonNormalCalendarData, setShowNonNormalCalendarData] = React.useState(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | undefined>(requestedSessionId);
  const history = filterAnalyticsHistory(rawHistory);
  const sortedHistory = React.useMemo(() => listSessionHistory(rawHistory, historyFilter), [rawHistory, historyFilter]);
  const calendar = React.useMemo(
    () => buildTrainingCalendar(rawHistory, undefined, { includeDataFlags: showNonNormalCalendarData ? 'all' : undefined }),
    [rawHistory, showNonNormalCalendarData]
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState(() => selectedDate || todayKey());
  const selectedCalendarDay = calendar.days.find((day) => day.date === selectedCalendarDate) || calendar.days.find((day) => day.totalSessions > 0);
  const selectedCalendarSessions = selectedCalendarDay?.sessions || [];
  const selectedHistorySession = rawHistory.find((session) => session.id === selectedSessionId) || null;
  const monthStats = buildMonthStats(history, data.bodyWeights || []);
  const prs = buildPrs(history);
  const barData = buildRecentSessionBars(history);
  const weeklyReport = buildWeeklyReport(history, data.bodyWeights || []);
  const coreTrends = CORE_TREND_EXERCISES.map((item) => ({ ...item, trend: buildExerciseTrend(history, item.id) }));
  const coreE1rmProfiles = CORE_TREND_EXERCISES.map((item) => ({ ...item, profile: buildE1RMProfile(history, item.id) }));
  const deloadSignal = buildDeloadSignal(data);
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const adherenceReport = buildAdherenceReport(history);
  const adherenceAdjustment = buildAdherenceAdjustment(adherenceReport, data.programTemplate, data.screeningProfile?.adaptiveState);
  const painPatterns = buildPainPatterns(history).slice(0, 6);
  const effectiveSummary = buildEffectiveVolumeSummary(history);
  const muscleDashboard = buildMuscleVolumeDashboard(history, weeklyPrescription);
  const loadFeedbackSummary = buildLoadFeedbackSummary(history);
  const trainingLevelAssessment = buildTrainingLevelAssessment({
    history,
    e1rmProfiles: coreE1rmProfiles.map((item) => item.profile),
    effectiveVolumeSummary: effectiveSummary,
    adherenceReport,
    painPatterns,
    calendarData: calendar,
  });
  const weeklyActions = buildWeeklyActionRecommendations({
    muscleVolumeDashboard: muscleDashboard,
    adherenceReport,
    loadFeedbackSummary,
    painPatterns,
    e1rmProfiles: coreE1rmProfiles.map((item) => item.profile),
    mesocycleWeek,
    programTemplate: data.programTemplate,
    screeningProfile: data.screeningProfile,
    history,
  });
  const sourceTemplate = data.templates.find((template) => template.id === (data.activeProgramTemplateId || data.selectedTemplateId)) || data.templates[0];
  const weeklyActionSignature = weeklyActions.map((item) => `${item.id}:${item.priority}:${item.confidence}`).join('|');
  const defaultSelectedActionIds = React.useMemo(
    () => weeklyActions.filter((item) => item.priority === 'high' && item.confidence !== 'low').map((item) => item.id),
    [weeklyActionSignature]
  );
  const [selectedActionIds, setSelectedActionIds] = React.useState<string[]>([]);
  const [previewDraft, setPreviewDraft] = React.useState<ProgramAdjustmentDraft | null>(null);
  const [adjustmentDiff, setAdjustmentDiff] = React.useState<ProgramAdjustmentDiff | null>(null);
  const [adjustmentDiffLoading, setAdjustmentDiffLoading] = React.useState(false);
  const [adjustmentEngineError, setAdjustmentEngineError] = React.useState('');
  const [adjustmentReviews, setAdjustmentReviews] = React.useState<Record<string, AdjustmentEffectReview>>({});

  React.useEffect(() => {
    if (initialSection) setActiveProgressSection(initialSection);
    if (requestedSessionId) {
      setSelectedSessionId(requestedSessionId);
      setActiveProgressSection(initialSection || 'history');
    }
    if (selectedDate) {
      setSelectedCalendarDate(selectedDate);
      if (!requestedSessionId) setActiveProgressSection(initialSection || 'calendar');
    }
  }, [initialSection, requestedSessionId, selectedDate]);

  React.useEffect(() => {
    setSelectedActionIds(defaultSelectedActionIds);
    setPreviewDraft(null);
    setAdjustmentDiff(null);
  }, [weeklyActionSignature, defaultSelectedActionIds]);

  const selectedActions = weeklyActions.filter((item) => selectedActionIds.includes(item.id));
  const adjustmentPreviews = previewDraft
    ? [{
        id: previewDraft.id,
        title: previewDraft.title,
        summary: previewDraft.summary,
        changes: previewDraft.changes,
        confidence: previewDraft.confidence,
      }]
    : [];
  const adjustmentHistory = data.programAdjustmentHistory || [];
  React.useEffect(() => {
    let cancelled = false;
    if (!previewDraft || !sourceTemplate) {
      setAdjustmentDiff(null);
      setAdjustmentDiffLoading(false);
      return undefined;
    }

    setAdjustmentDiffLoading(true);
    setAdjustmentEngineError('');
    import('../engines/programAdjustmentEngine')
      .then(({ buildAdjustmentDiff }) => {
        if (!cancelled) setAdjustmentDiff(buildAdjustmentDiff(previewDraft, sourceTemplate, data.programTemplate, data.templates));
      })
      .catch(() => {
        if (!cancelled) {
          setAdjustmentDiff(null);
          setAdjustmentEngineError('计划调整引擎加载失败，暂时不能生成差异预览。');
        }
      })
      .finally(() => {
        if (!cancelled) setAdjustmentDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewDraft, sourceTemplate, data.programTemplate, data.templates]);

  React.useEffect(() => {
    let cancelled = false;
    if (!adjustmentHistory.length) {
      setAdjustmentReviews({});
      return undefined;
    }

    import('../engines/adjustmentReviewEngine')
      .then(({ reviewAdjustmentEffect }) => {
        if (!cancelled) {
          setAdjustmentReviews(Object.fromEntries(adjustmentHistory.map((item) => [item.id, reviewAdjustmentEffect(item, history)])));
        }
      })
      .catch(() => {
        if (!cancelled) setAdjustmentEngineError('实验模板效果复盘引擎加载失败，历史仍可查看。');
      });
    return () => {
      cancelled = true;
    };
  }, [adjustmentHistory, history]);
  const volumeActionTargets = weeklyActions
    .filter((item) => item.category === 'volume' && number(item.suggestedChange?.setsDelta) > 0)
    .flatMap((item) => item.suggestedChange?.exerciseIds?.map((exerciseId) => ({ action: item, exerciseId })) || []);
  const latestSession = history[0];
  const latestSessionSummary = latestSession
    ? buildSessionSummaryExplanations({ session: latestSession, adherenceReport, adherenceAdjustment, painPatterns })
    : [];
  const weeklyCoachReview = buildWeeklyCoachReview({
    history,
    weeklyPrescription,
    adherenceReport,
    adherenceAdjustment,
    painPatterns,
    weeklyActions,
    plannedSessionsPerWeek: data.programTemplate?.daysPerWeek || data.userProfile?.weeklyTrainingDays || 4,
  });

  const downloadBackup = async () => {
    const { exportAppData, getBackupFileName } = await import('../storage/backup');
    downloadText(getBackupFileName(), exportAppData(data), 'application/json');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { importAppData } = await import('../storage/backup');
    const result = importAppData(text);
    if (!result.ok || !result.data) {
      setRestoreMessage(result.error || '导入失败，当前数据没有被覆盖。');
      return;
    }
    if (!window.confirm('确定导入这个备份吗？当前本地数据会被替换。')) return;
    onRestoreData(result.data);
    setRestoreMessage('导入成功，数据已恢复。');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateAdjustmentPreview = async () => {
    if (!sourceTemplate || !selectedActions.length) return;
    setAdjustmentDiff(null);
    setAdjustmentDiffLoading(true);
    setAdjustmentEngineError('');
    try {
      const { createAdjustmentDraftFromRecommendations } = await import('../engines/programAdjustmentEngine');
      setPreviewDraft(
        createAdjustmentDraftFromRecommendations(selectedActions, sourceTemplate, {
          programTemplate: data.programTemplate,
          templates: data.templates,
          screeningProfile: data.screeningProfile,
          painPatterns,
        }),
      );
    } catch {
      setAdjustmentEngineError('计划调整引擎加载失败，暂时不能生成调整预览。');
    } finally {
      setAdjustmentDiffLoading(false);
    }
  };

  const openSessionDetail = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setActiveProgressSection('history');
  };

  const renderEmptyHistory = () => (
    <EmptyState
      title="暂无训练记录"
      description="完成一次训练后，这里会自动显示训练日历和历史详情。"
      action={
        onStartTraining ? (
          <ActionButton variant="primary" onClick={onStartTraining}>
            开始训练
          </ActionButton>
        ) : undefined
      }
    />
  );

  const renderDataFlagBadge = (flag?: SessionDataFlag) => (
    <StatusBadge tone={flag === 'test' ? 'amber' : flag === 'excluded' ? 'slate' : 'emerald'}>{dataFlagLabel(flag)}</StatusBadge>
  );

  const renderSessionDetail = (session: TrainingSession | null) => {
    if (!session) return null;
    const effective = buildEffectiveVolumeSummary([session]);
    return (
      <section className="rounded-lg border border-emerald-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">{session.templateName || session.focus || '训练详情'}</h2>
              {renderDataFlagBadge(session.dataFlag)}
              {session.isExperimentalTemplate ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">实验模板</span> : null}
            </div>
            <div className="mt-1 text-sm font-bold text-slate-500">
              {session.date} / {formatSessionTime(session)} / {session.durationMin || 0} 分钟
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="完成组" value={sessionCompletedSets(session)} />
            <Stat label="有效组" value={effective.effectiveSets} tone="emerald" />
            <Stat label="总量" value={formatWeight(sessionVolume(session), unitSettings)} tone="amber" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {session.focusWarmupSetLogs?.length ? (
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="mb-2 text-xs font-black text-slate-500">热身组</div>
              <div className="space-y-1 text-sm font-bold text-slate-700">
                {session.focusWarmupSetLogs.map((set, index) => (
                  <div key={set.id || index}>
                    热身 {index + 1}：{formatWeight(set.weight, unitSettings)} x {set.reps}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {session.exercises.map((exercise) => (
            <div key={`${session.id}-${exercise.id}`} className="rounded-lg bg-stone-50 p-3">
              <div className="font-black text-slate-950">{exercise.alias || exercise.name}</div>
              {exercise.replacedFromName ? (
                <div className="mt-1 rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                  原计划：{exercise.replacedFromName} / 实际执行：{exercise.alias || exercise.name}
                </div>
              ) : null}
              <div className="mt-2 space-y-1 text-sm font-bold text-slate-700">
                {Array.isArray(exercise.sets) && exercise.sets.length ? (
                  exercise.sets.map((set, index) => (
                    <div key={set.id || `${exercise.id}-${index}`} className={set.done ? '' : 'text-slate-400'}>
                      {set.type === 'warmup' ? '热身组' : '正式组'} {index + 1}：{set.done ? `${formatWeight(set.weight, unitSettings)} x ${set.reps}` : '未完成'}
                      {set.rir !== undefined && set.rir !== '' ? ` / RIR ${set.rir}` : ''}
                      {set.techniqueQuality ? ` / ${formatTechniqueQuality(set.techniqueQuality)}` : ''}
                      {set.painFlag ? ' / 不适' : ''}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">没有主训练组记录。</div>
                )}
              </div>
            </div>
          ))}

          {(session.supportExerciseLogs || []).length ? (
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="mb-2 text-xs font-black text-slate-500">纠偏 / 功能补丁</div>
              <div className="space-y-1 text-sm font-bold text-slate-700">
                {(session.supportExerciseLogs || []).map((log) => (
                  <div key={`${log.moduleId}-${log.exerciseId}`}>
                    {log.exerciseName || '辅助动作'}：{log.completedSets}/{log.plannedSets} 组
                    {log.skippedReason ? ` / 跳过：${formatSkippedReason(log.skippedReason)}` : ''}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onDeleteSession(session.id)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-700">
            删除本次训练
          </button>
          <button type="button" onClick={() => onMarkSessionDataFlag(session.id, session.dataFlag === 'test' ? 'normal' : 'test')} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-black text-amber-700">
            {session.dataFlag === 'test' ? '恢复为正常数据' : '标记为测试数据'}
          </button>
          {session.dataFlag === 'excluded' ? (
            <button type="button" onClick={() => onMarkSessionDataFlag(session.id, 'normal')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
              恢复为正常数据
            </button>
          ) : null}
          <button type="button" onClick={() => setSelectedSessionId(undefined)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            关闭详情
          </button>
        </div>
      </section>
    );
  };

  const renderCalendarPanel = () => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-black text-slate-950">训练日历</h2>
          <p className="mt-1 text-sm text-slate-500">默认只显示正常训练。打开开关后，可查看测试/排除数据，但它们仍不计入统计。</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-black text-slate-700">
          <input type="checkbox" checked={showNonNormalCalendarData} onChange={(event) => setShowNonNormalCalendarData(event.target.checked)} />
          显示测试 / 排除数据
        </label>
      </div>
      {!rawHistory.length ? renderEmptyHistory() : null}
      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
            <span>{calendar.month}</span>
            <span>本月 {calendar.days.reduce((sum, day) => sum + day.totalSessions, 0)} 次</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => <div key={label}>{label}</div>)}
            {calendar.days.map((day) => {
              const selected = selectedCalendarDay?.date === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedCalendarDate(day.date)}
                  className={classNames(
                    'min-h-12 rounded-lg border px-1 py-2 text-xs font-black',
                    selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-stone-50 text-slate-600'
                  )}
                >
                  <div>{Number(day.date.slice(-2))}</div>
                  {day.totalSessions ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  {day.hasPainFlags ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {calendar.weeklyFrequency.length ? calendar.weeklyFrequency.map((week) => (
              <div key={week.weekStart} className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">{formatDate(week.weekStart)} 周</div>
                <div className="mt-1 text-xl font-black text-slate-950">{week.sessionCount} 次</div>
              </div>
            )) : <div className="rounded-lg bg-stone-50 p-3 text-sm text-slate-500 sm:col-span-4">最近 4 周暂无训练频率数据。</div>}
          </div>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <div className="text-sm font-black text-slate-950">{selectedCalendarDay?.date || selectedCalendarDate}</div>
          <div className="mt-2 space-y-2">
            {selectedCalendarSessions.length ? selectedCalendarSessions.map((session) => {
              const rawSession = rawHistory.find((item) => item.id === session.sessionId);
              return (
                <div key={session.sessionId} className="rounded-lg bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black text-slate-950">{session.title}</div>
                    {renderDataFlagBadge(session.dataFlag)}
                  </div>
                  <div className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    {session.templateName || '未命名模板'} / {rawSession ? formatSessionTime(rawSession) : '未记录时间'} / {session.completedSets} 组
                  </div>
                  <div className="mt-1 text-xs font-bold text-emerald-700">
                    有效组 {session.effectiveSets} / 总量 {formatWeight(session.totalVolumeKg, unitSettings)}
                  </div>
                  <button type="button" onClick={() => openSessionDetail(session.sessionId)} className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">
                    查看详情
                  </button>
                </div>
              );
            }) : <div className="rounded-lg bg-white p-4 text-sm text-slate-500">当天没有训练记录。</div>}
          </div>
        </div>
      </div>
    </section>
  );

  const renderHistoryPanel = () => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-black text-slate-950">历史训练</h2>
          <p className="mt-1 text-sm text-slate-500">这里是回顾和清理训练记录的主入口。测试/排除数据可见，但不会进入统计。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {historyFilterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setHistoryFilter(option.id)}
              className={classNames(
                'h-10 rounded-lg border px-3 text-sm font-black',
                historyFilter === option.id ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {!rawHistory.length ? renderEmptyHistory() : null}
      {selectedHistorySession ? <div className="mb-3">{renderSessionDetail(selectedHistorySession)}</div> : null}
      <div className="space-y-2">
        {sortedHistory.map((session) => {
          const effective = buildEffectiveVolumeSummary([session]);
          return (
            <div key={session.id} className="flex flex-col gap-2 rounded-lg bg-stone-50 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-black text-slate-950">
                  {session.templateName || session.focus || '训练'}
                  {renderDataFlagBadge(session.dataFlag)}
                  {session.isExperimentalTemplate ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">实验</span> : null}
                </div>
                <div className="text-sm text-slate-500">
                  {session.date} / {formatSessionTime(session)} / {sessionCompletedSets(session)} 组 / 有效 {effective.effectiveSets} 组 / {session.durationMin || 0} 分钟
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-black text-emerald-700">{formatWeight(sessionVolume(session), unitSettings)}</div>
                <button type="button" onClick={() => setSelectedSessionId(session.id)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">
                  查看详情
                </button>
                <button type="button" onClick={() => onMarkSessionDataFlag(session.id, session.dataFlag === 'test' ? 'normal' : 'test')} className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-black text-amber-700">
                  {session.dataFlag === 'test' ? '恢复正式' : '标记测试'}
                </button>
                <button type="button" onClick={() => onDeleteSession(session.id)} className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700">
                  删除
                </button>
              </div>
            </div>
          );
        })}
        {rawHistory.length && !sortedHistory.length ? <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">当前筛选下没有训练记录。</div> : null}
      </div>
    </section>
  );

  const renderPrPanel = () => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-black text-slate-950">个人记录 / PR</h2>
      {prs.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {prs.map((pr) => (
            <div key={pr.key} className="rounded-lg border border-slate-200 bg-stone-50 p-4">
              <div className="text-xs font-black text-slate-500">{pr.type}</div>
              <div className="mt-1 font-black text-slate-950">{pr.exercise}</div>
              <div className="mt-2 text-2xl font-black text-emerald-700">{pr.displayValue}</div>
              <div className="mt-2 inline-flex rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{formatPersonalRecordQuality(pr.quality)}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">{pr.date}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">正常训练数据不足，先完成几次训练后再看 PR。</div>
      )}
    </section>
  );

  const renderDataPanel = () => (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-black text-slate-950">数据管理</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-stone-50 p-3">
          <div className="mb-2 text-sm font-black text-slate-950">重量单位</div>
          <div className="grid grid-cols-2 gap-2">
            {(['kg', 'lb'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => onUpdateUnitSettings({ weightUnit: unit })}
                className={classNames(
                  'h-11 rounded-lg border text-sm font-black',
                  unitSettings.weightUnit === unit ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
                )}
              >
                {unit}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">切换单位只影响显示和输入，内部历史仍按 kg 保存。</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <div className="mb-2 text-sm font-black text-slate-950">备份 / 恢复</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadBackup} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white">
              <Save className="h-4 w-4" /> 下载备份
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
              导入备份
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => handleImportFile(event.target.files?.[0])} />
          {restoreMessage ? <div className="mt-2 text-sm font-bold text-slate-600">{restoreMessage}</div> : null}
        </div>
      </div>
    </section>
  );

  return (
    <Page
      eyebrow="记录"
      title="训练记录"
      action={
        <div className="flex flex-wrap gap-2">
          <ActionButton
            type="button"
            onClick={() => downloadText(`ironpath-${todayKey()}.json`, JSON.stringify(data, null, 2), 'application/json')}
            variant="secondary"
          >
            <Download className="h-4 w-4" />
            导出 JSON
          </ActionButton>
          <ActionButton
            type="button"
            onClick={() => downloadText(`ironpath-${todayKey()}.csv`, makeCsv(history), 'text/csv;charset=utf-8')}
            variant="secondary"
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </ActionButton>
        </div>
      }
    >
      <Card className="mb-4" padded={false}>
        <div className="p-3">
          <SegmentedTabs value={activeProgressSection} options={progressSections} onChange={setActiveProgressSection} ariaLabel="进度中心分区" />
          {!rawHistory.length ? (
            <div className="mt-3">
              <EmptyState
                title="暂无训练记录"
                description="完成一次训练后，这里会自动显示训练日历。"
                action={
                  onStartTraining ? (
                    <ActionButton variant="primary" onClick={onStartTraining}>
                      开始训练
                    </ActionButton>
                  ) : undefined
                }
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">训练基线</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{formatAutoTrainingLevel(trainingLevelAssessment.level)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {trainingLevelAssessment.level === 'unknown'
                ? '正在建立训练基线。完成 2–3 次训练后，系统会开始估算当前力量、有效组和训练等级。'
                : `当前判断置信度：${formatAdherenceConfidence(trainingLevelAssessment.confidence)}。`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={trainingLevelAssessment.readinessForAdvancedFeatures.topBackoff ? 'emerald' : 'slate'}>
              顶组/回退组{trainingLevelAssessment.readinessForAdvancedFeatures.topBackoff ? '已启用' : '保守关闭'}
            </StatusBadge>
            <StatusBadge tone={trainingLevelAssessment.readinessForAdvancedFeatures.higherVolume ? 'emerald' : 'slate'}>
              高容量{trainingLevelAssessment.readinessForAdvancedFeatures.higherVolume ? '可用' : '未启用'}
            </StatusBadge>
            <StatusBadge tone={trainingLevelAssessment.readinessForAdvancedFeatures.aggressiveProgression ? 'emerald' : 'slate'}>
              激进进阶{trainingLevelAssessment.readinessForAdvancedFeatures.aggressiveProgression ? '可用' : '关闭'}
            </StatusBadge>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {trainingLevelAssessment.signals.slice(0, 3).map((item) => (
            <div key={item.name} className="rounded-lg bg-stone-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">{item.name}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.score} / 100</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</div>
            </div>
          ))}
        </div>
        {trainingLevelAssessment.nextDataNeeded.length ? (
          <div className="mt-3 text-xs leading-5 text-slate-500">还需要：{trainingLevelAssessment.nextDataNeeded.slice(0, 2).join(' / ')}</div>
        ) : null}
      </Card>

      <div className="mb-4 space-y-4">
        {activeProgressSection === 'calendar' ? renderCalendarPanel() : null}
        {activeProgressSection === 'history' ? renderHistoryPanel() : null}
        {activeProgressSection === 'pr' ? renderPrPanel() : null}
        {activeProgressSection === 'data' ? renderDataPanel() : null}
      </div>

      {activeProgressSection === 'dashboard' ? (
        !history.length ? (
          <Card>
            <EmptyState
              title="还没有可统计的训练"
              description="完成一次正式训练后，将自动生成周训练量、PR、e1RM 和趋势图。"
            />
          </Card>
        ) : (
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-4">
          <WeeklyPrescriptionCard weeklyPrescription={weeklyPrescription} />

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">本周训练量仪表盘</div>
                <h2 className="mt-1 font-black text-slate-950">
                  肌群训练量 <Term id="weightedEffectiveSet" label="加权有效组" compact />
                </h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {muscleDashboard.map((row) => {
                const target = Math.max(1, row.targetSets);
                const percent = Math.min(120, Math.round((row.weightedEffectiveSets / target) * 100));
                return (
                  <div key={row.muscleId} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-slate-950">{row.muscleName}</div>
                      <span className={`rounded-md px-2 py-1 text-xs font-black ${volumeStatusClasses[row.status]}`}>
                        {volumeStatusLabels[row.status]}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                      <span>目标 {row.targetSets} 组</span>
                      <span>完成 {row.completedSets} 组</span>
                      <span>有效 {row.effectiveSets} 组</span>
                      <span>高置信 {row.highConfidenceEffectiveSets} 组</span>
                      <span>加权 {row.weightedEffectiveSets} 组</span>
                      <span>还差 {row.remainingSets} 组</span>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">{row.notes[0]}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {adjustmentEngineError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{adjustmentEngineError}</div>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">本周问题摘要</div>
              <h2 className="mt-1 font-black text-slate-950">下周最该处理什么</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Stat label="高优先级" value={weeklyActions.filter((item) => item.priority === 'high').length} tone="amber" />
              <Stat label="中优先级" value={weeklyActions.filter((item) => item.priority === 'medium').length} />
              <Stat label="已选择建议" value={selectedActionIds.length} tone="emerald" />
            </div>
            <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-700">
              {weeklyActions[0]?.issue || '当前数据还不足，先继续记录训练完成度、RIR、动作质量和推荐重量反馈。'}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">下周行动建议</div>
                <h2 className="mt-1 font-black text-slate-950">可执行调整</h2>
              </div>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">仅建议，不自动应用</span>
            </div>
            <div className="space-y-3">
              {weeklyActions.slice(0, 6).map((action) => {
                const explanation = buildWeeklyActionExplanation(action);
                const evidence = formatExplanationEvidence(explanation);
                const selected = selectedActionIds.includes(action.id);
                return (
                  <details key={action.id} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => {
                            setPreviewDraft(null);
                            setSelectedActionIds((current) =>
                              current.includes(action.id) ? current.filter((id) => id !== action.id) : [...current, action.id]
                            );
                          }}
                          className="h-5 w-5 rounded border-slate-300 accent-emerald-600"
                          aria-label={`选择${action.targetLabel}建议`}
                        />
                        <span className={`rounded-md px-2 py-1 text-xs font-black ${actionPriorityClasses[action.priority]}`}>
                          {formatWeeklyActionPriority(action.priority)}
                        </span>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{formatWeeklyActionCategory(action.category)}</span>
                        <span className="font-black text-slate-950">{action.targetLabel}</span>
                      </div>
                      <div className="mt-2 text-sm font-bold leading-6 text-slate-700">{action.recommendation}</div>
                    </summary>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <div>
                        <span className="font-black text-slate-950">问题：</span>
                        {action.issue}
                      </div>
                      <div>
                        <span className="font-black text-slate-950">原因：</span>
                        {action.reason}
                      </div>
                      <div className="rounded-md bg-white px-3 py-2">{formatExplanationItem(explanation)}</div>
                      {evidence.length ? <div className="text-xs font-bold text-slate-500">依据：{evidence.join(' / ')}</div> : null}
                    </div>
                  </details>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-bold leading-5 text-slate-500">
                已选择 {selectedActionIds.length} 条建议。生成预览后会显示每项调整的 before / after。
              </div>
              <button
                type="button"
                disabled={!sourceTemplate || !selectedActions.length || adjustmentDiffLoading}
                onClick={() => void generateAdjustmentPreview()}
                className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {adjustmentDiffLoading ? '正在生成...' : '生成调整预览'}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">推荐补量动作</div>
              <h2 className="mt-1 font-black text-slate-950">优先放进下周的动作</h2>
            </div>
            {volumeActionTargets.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {volumeActionTargets.slice(0, 6).map(({ action, exerciseId }) => (
                  <div key={`${action.id}-${exerciseId}`} className="rounded-lg bg-stone-50 p-3">
                    <div className="font-black text-slate-950">{EXERCISE_DISPLAY_NAMES[exerciseId] || exerciseId}</div>
                    <div className="mt-1 text-sm font-bold leading-6 text-slate-600">{action.recommendation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-500">目前没有高置信补量动作建议，优先维持现有结构并继续记录。</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">计划调整预览</div>
              <h2 className="mt-1 font-black text-slate-950">下周微调草案</h2>
            </div>
            <div className="space-y-3">
              {adjustmentPreviews.map((preview) => (
                <div key={preview.id} className="rounded-lg bg-stone-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black text-slate-950">{preview.title}</div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">置信度 {formatAdherenceConfidence(preview.confidence)}</span>
                  </div>
                  <div className="mt-1 text-sm font-bold leading-6 text-slate-600">{preview.summary}</div>
                  <div className="mt-3 space-y-2">
                    {(adjustmentDiff?.changes || []).map((change) => (
                      <div key={change.changeId} className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-950">{change.label || previewChangeLabels[change.type]}</span>
                          <span className={`rounded-md px-2 py-1 text-xs font-black ${riskClasses[change.riskLevel]}`}>
                            {formatAdjustmentRiskLevel(change.riskLevel)}
                          </span>
                        </div>
                        <div className="mt-2 leading-6">
                          <div><span className="font-black text-slate-950">调整前：</span>{change.before}</div>
                          <div><span className="font-black text-slate-950">调整后：</span>{change.after}</div>
                        </div>
                        <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{change.reason}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                    当前版本只生成预览，不会自动修改计划模板。需要应用时应复制模板后再确认。
                  </div>
                </div>
              ))}
            </div>
          </section>

          {adjustmentDiff ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-emerald-700">实验模板差异</div>
                  <h2 className="mt-1 font-black text-slate-950">应用前确认 before / after</h2>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
                  {previewDraft ? formatAdherenceConfidence(previewDraft.confidence) : '低'} 置信
                </span>
              </div>
              <div className="space-y-2">
                {adjustmentDiff.changes.map((change) => (
                  <div key={change.changeId} className="rounded-lg bg-white p-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-950">{change.label || formatAdjustmentChangeLabel(change.type)}</span>
                      <span className={`rounded-md px-2 py-1 text-xs font-black ${riskClasses[change.riskLevel]}`}>{formatAdjustmentRiskLevel(change.riskLevel)}</span>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-md bg-stone-50 px-3 py-2">
                        <span className="font-black text-slate-950">调整前：</span>
                        {change.before}
                      </div>
                      <div className="rounded-md bg-emerald-50 px-3 py-2">
                        <span className="font-black text-emerald-950">调整后：</span>
                        {change.after}
                      </div>
                    </div>
                    <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{change.reason}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-emerald-950">
                应用后会复制生成新的下周实验模板，不覆盖原模板；回滚时只切回原模板，并保留调整历史。
              </div>
              <button
                type="button"
                disabled={!previewDraft || !adjustmentDiff.changes.length || adjustmentDiff.changes.every((change) => change.riskLevel === 'high')}
                onClick={() => {
                  if (!previewDraft) return;
                  const hasHighRisk = adjustmentDiff.changes.some((change) => change.riskLevel === 'high');
                  if (hasHighRisk && !window.confirm('预览里包含高风险调整，确定仍要作为实验模板应用吗？')) return;
                  if (!window.confirm('确认应用为下周实验模板吗？这不会覆盖原模板，并且可以回滚。')) return;
                  onApplyProgramAdjustmentDraft(previewDraft);
                }}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                应用为下周实验模板
              </button>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">调整历史 / 回滚</div>
              <h2 className="mt-1 font-black text-slate-950">实验模板追踪</h2>
            </div>
            {adjustmentHistory.length ? (
              <div className="space-y-3">
                {adjustmentHistory.slice(0, 6).map((item) => {
                  const review = adjustmentReviews[item.id];
                  const sourceName = formatProgramTemplateName(item.sourceProgramTemplateName || item.sourceProgramTemplateId);
                  const experimentalName = formatProgramTemplateName(item.experimentalProgramTemplateName || item.experimentalProgramTemplateId);
                  return (
                    <div key={item.id} className="rounded-lg bg-stone-50 p-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-slate-950">{item.appliedAt.slice(0, 10)} 实验模板</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {review ? (
                            <span className={`rounded-md px-2 py-1 text-xs font-black ${adjustmentReviewTone[review.status]}`}>
                              {formatAdjustmentReviewStatus(review.status)}
                            </span>
                          ) : null}
                          <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
                            {item.rollbackAvailable ? '可回滚' : '已回滚'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 leading-6">
                        来源模板：{sourceName}
                        <br />
                        实验模板：{experimentalName}
                      </div>
                      <div className="mt-2 rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                        主要变更：{summarizeHistoryChanges(item)}
                      </div>
                      {review ? (
                        <div className="mt-2 rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                          复盘：{review.summary}
                        </div>
                      ) : null}
                      {item.rolledBackAt ? (
                        <div className="mt-2 text-xs font-bold text-slate-500">已于 {item.rolledBackAt.slice(0, 10)} 回滚到原模板。</div>
                      ) : null}
                      {item.rollbackAvailable ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm('确认回滚到原模板吗？这不会删除实验模板历史。')) return;
                            onRollbackProgramAdjustment(item.id);
                          }}
                          className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"
                        >
                          回滚到原模板
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-500">
                还没有应用过实验模板。生成并确认下周实验模板后，这里会保留调整记录和回滚入口。
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">训练后总结</div>
                <h2 className="mt-1 font-black text-slate-950">最近一次训练解释</h2>
              </div>
              {latestSession ? <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">{latestSession.templateName}</span> : null}
            </div>
            {latestSessionSummary.length ? (
              <div className="space-y-2">
                {latestSessionSummary.map((line) => (
                  <div key={line} className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-700">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-500">完成一场训练后，这里会自动生成训练后解释总结。</div>
            )}
            {loadFeedbackSummary.total ? (
              <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold leading-6 text-emerald-900">
                最近记录了 {loadFeedbackSummary.total} 条推荐重量反馈：
                偏轻 {loadFeedbackSummary.counts.too_light} / 合适 {loadFeedbackSummary.counts.good} / 偏重 {loadFeedbackSummary.counts.too_heavy}。
                {loadFeedbackSummary.adjustment.reasons[0]}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">每周训练总结</div>
              <h2 className="mt-1 font-black text-slate-950">系统教练回看</h2>
            </div>
            <div className="space-y-2">
              {weeklyCoachReview.map((line) => (
                <div key={line} className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  {line}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">完成度如何影响下周计划</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <Stat label="复杂度" value={formatComplexityLevel(adherenceAdjustment.complexityLevel)} />
              <Stat label="周训练量系数" value={`${Math.round(adherenceAdjustment.weeklyVolumeMultiplier * 100)}%`} />
              <Stat label="纠偏剂量" value={formatSupportDoseAdjustment(adherenceAdjustment.correctionDoseAdjustment)} tone="emerald" />
              <Stat label="功能补丁" value={formatSupportDoseAdjustment(adherenceAdjustment.functionalDoseAdjustment)} tone="amber" />
            </div>
            <div className="mt-3 space-y-2">
              {adherenceAdjustment.reasons.map((reason) => (
                <div key={reason} className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                  {reason}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="当前体重" value={data.bodyWeights[0] ? `${data.bodyWeights[0].value}kg` : '未记录'} tone="emerald" />
            <Stat label="7 天均重" value={monthStats.sevenDayAverage ? `${monthStats.sevenDayAverage.toFixed(1)}kg` : '未记录'} />
            <Stat label="本月训练" value={`${monthStats.monthSessions.length} 次`} tone="amber" />
            <Stat label="本月时长" value={`${monthStats.monthMinutes} 分钟`} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">记录体重</h2>
            <div className="flex gap-2">
              <input
                type="number"
                value={bodyWeightInput}
                onChange={(event) => setBodyWeightInput(event.target.value)}
                placeholder="今天体重 kg"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-base font-bold outline-none focus:border-emerald-500 md:text-sm"
              />
              <button type="button" onClick={onSaveBodyWeight} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white">
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {monthStats.lastWeights.map((entry) => (
                <div key={entry.date} className="flex justify-between rounded-md bg-stone-50 px-3 py-2 text-sm">
                  <span className="font-bold text-slate-500">{entry.date}</span>
                  <span className="font-black text-slate-950">{entry.value}kg</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">数据备份 / 恢复</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={downloadBackup} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
                导出完整备份
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                导入备份 JSON
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImportFile(event.target.files?.[0])} />
            {restoreMessage ? <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm font-bold text-slate-700">{restoreMessage}</div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">周报文案</h2>
            <div className="rounded-lg bg-slate-950 p-4 text-white">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-300">IronPath 周报</div>
              <div className="mt-3 whitespace-pre-line text-sm leading-6">{weeklyReport}</div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(weeklyReport)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
            >
              <Copy className="h-4 w-4" />
              复制周报
            </button>
          </section>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="本月总训练量" value={`${Math.round(monthStats.monthVolume)}kg`} tone="emerald" />
            <Stat label="历史训练" value={`${history.length} 次`} />
            <Stat label="历史完成组数" value={history.reduce((sum, session) => sum + sessionCompletedSets(session), 0)} tone="amber" />
            <Stat label="有效组 / 高置信" value={`${effectiveSummary.effectiveSets} / ${effectiveSummary.highConfidenceEffectiveSets}`} tone="emerald" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">最近训练量</h2>
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            {barData.lastEightSessions.length ? (
              <div className="space-y-3">
                {barData.lastEightSessions.map((session) => (
                  <div key={session.id}>
                    <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
                      <span>{session.label}</span>
                      <span>{Math.round(session.volume)}kg</span>
                    </div>
                    <div className="h-3 rounded-md bg-stone-100">
                      <div className="h-3 rounded-md bg-emerald-600" style={{ width: `${Math.max(5, (session.volume / barData.maxBar) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">完成第一场训练后，这里会开始显示趋势。</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">核心动作趋势</h2>
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {coreTrends.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-black text-slate-950">{item.label}</div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{trendStatus(item.trend)}</span>
                  </div>
                  {item.trend.length ? (
                    <div className="space-y-2">
                      {item.trend.map((entry) => (
                        <div key={`${item.id}-${entry.date}`} className="grid grid-cols-[54px_1fr_auto] gap-2 text-xs font-bold text-slate-600">
                          <span>{formatDate(entry.date)}</span>
                          <span>
                            {entry.topWeight}kg x {entry.topReps}
                          </span>
                          <span>{Math.round(entry.volume)}kg</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md bg-white p-3 text-sm text-slate-500">暂无该动作记录。</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">当前力量估算</h2>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">训练推荐使用当前估算</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {coreE1rmProfiles.map((item) => {
                const current = item.profile.current?.confidence === 'low' ? undefined : item.profile.current;
                const best = item.profile.best;
                const currentLowerThanBest = current && best && best.e1rmKg > current.e1rmKg + 2.5;
                return (
                  <details key={item.id} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                    <summary className="cursor-pointer list-none font-black text-slate-950">{item.label}</summary>
                    {current ? (
                      <div className="mt-2 space-y-1 text-sm font-bold text-slate-700">
                        <div>当前 e1RM：{current.e1rmKg}kg / 置信度 {formatAdherenceConfidence(current.confidence)}</div>
                        <div>估算方法：{e1rmMethodLabels[item.profile.method || 'median_recent']}</div>
                        <div>
                          来源：{current.sourceSet.weightKg}kg x {current.sourceSet.reps}，{current.sourceSet.date}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-500">近期高质量数据不足，暂不生成当前 e1RM。</div>
                    )}
                    {best ? (
                      <div className="mt-2 text-sm font-bold text-slate-600">
                        历史最佳 e1RM：{best.e1rmKg}kg / {formatAdherenceConfidence(best.confidence)}
                      </div>
                    ) : null}
                    {currentLowerThanBest ? (
                      <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                        历史最佳不代表当前可用训练负荷，本系统优先使用近期稳定估算。
                      </div>
                    ) : null}
                  </details>
                );
              })}
            </div>
          </section>

          <section className={deloadSignal.triggered ? 'rounded-lg border border-rose-200 bg-rose-50 p-4' : 'rounded-lg border border-slate-200 bg-white p-4'}>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">疲劳提醒</div>
            <h2 className="font-black text-slate-950">{deloadSignal.title}</h2>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-700">{deloadSignal.reasons.length ? deloadSignal.reasons.join(' / ') : '当前趋势还没有触发自动减量。'}</div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">完成度分析</h2>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">
                最近 {adherenceReport.recentSessionCount} 次 / 可信度 {formatAdherenceConfidence(adherenceReport.confidence)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">总完成率</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{adherenceReport.overallRate}%</div>
                <div className="mt-1 text-sm text-slate-600">
                  计划 {adherenceReport.plannedSets} 组 / 实际 {adherenceReport.actualSets} 组
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">分块完成率</div>
                <div className="mt-1 text-sm font-bold text-slate-700">主训练 {adherenceReport.mainlineRate}%</div>
                <div className="text-sm font-bold text-slate-700">纠偏模块 {adherenceReport.correctionRate ?? '--'}%</div>
                <div className="text-sm font-bold text-slate-700">功能补丁 {adherenceReport.functionalRate ?? '--'}%</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-black text-slate-950">经常跳过的主训练动作：</span>
                {adherenceReport.skippedExercises.length ? adherenceReport.skippedExercises.map((item) => `${item.exerciseId} (${item.count})`).join(' / ') : '暂无明显跳过动作'}
              </div>
              <div>
                <span className="font-black text-slate-950">经常未完成的辅助动作：</span>
                {adherenceReport.skippedSupportExercises.length
                  ? adherenceReport.skippedSupportExercises.map((item) => `${item.exerciseId} (${item.count}${item.mostCommonReason ? ` / ${formatSkippedReason(item.mostCommonReason)}` : ''})`).join(' / ')
                  : '暂无明显未完成的辅助动作'}
              </div>
              {adherenceReport.suggestions.map((item) => (
                <div key={item} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">疼痛 / 不适模式</h2>
            {painPatterns.length ? (
              <div className="space-y-2">
                {painPatterns.map((pattern) => (
                  <div key={`${pattern.area}-${pattern.exerciseId || 'area'}`} className="rounded-md bg-stone-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-slate-950">{pattern.exerciseId || pattern.area}</div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{formatPainAction(pattern.suggestedAction)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      部位：{pattern.area} / 频率 {pattern.frequency} / 平均强度 {pattern.severityAvg.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">最近没有明显的重复不适模式。</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">最佳记录追踪</h2>
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            {prs.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {prs.map((pr) => (
                  <div key={pr.key} className="rounded-lg border border-slate-200 bg-stone-50 p-4">
                    <div className="text-xs font-black text-slate-500">{pr.type}</div>
                    <div className="mt-1 font-black text-slate-950">{pr.exercise}</div>
                    <div className="mt-2 text-2xl font-black text-emerald-700">{pr.displayValue}</div>
                    <div className="mt-2 inline-flex rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{formatPersonalRecordQuality(pr.quality)}</div>
                    {pr.reasons?.length ? <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{pr.reasons[0]}</div> : null}
                    <div className="mt-1 text-xs font-bold text-slate-500">{pr.date}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">先记录几次核心动作，最佳记录会自动生成。</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-slate-950">训练日历</h2>
                <p className="mt-1 text-sm text-slate-500">按日期回看训练频率、训练时间和当天详情。测试/排除数据不会进入统计。</p>
              </div>
              <CalendarDays className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_280px]">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
                  <span>{calendar.month}</span>
                  <span>本月 {calendar.days.reduce((sum, day) => sum + day.totalSessions, 0)} 次</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
                  {['一', '二', '三', '四', '五', '六', '日'].map((label) => <div key={label}>{label}</div>)}
                  {calendar.days.map((day) => {
                    const selected = selectedCalendarDay?.date === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedCalendarDate(day.date)}
                        className={classNames(
                          'min-h-12 rounded-lg border px-1 py-2 text-xs font-black',
                          selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-stone-50 text-slate-600'
                        )}
                      >
                        <div>{Number(day.date.slice(-2))}</div>
                        {day.totalSessions ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                        {day.hasPainFlags ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {calendar.weeklyFrequency.map((week) => (
                    <div key={week.weekStart} className="rounded-lg bg-stone-50 p-3">
                      <div className="text-xs font-black text-slate-500">{formatDate(week.weekStart)} 周</div>
                      <div className="mt-1 text-xl font-black text-slate-950">{week.sessionCount} 次</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="text-sm font-black text-slate-950">{selectedCalendarDay?.date || '选择日期'}</div>
                <div className="mt-2 space-y-2">
                  {selectedCalendarSessions.length ? selectedCalendarSessions.map((session) => (
                    <div key={session.sessionId} className="rounded-lg bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-black text-slate-950">{session.title}</div>
                        {session.isExperimentalTemplate ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">实验</span> : null}
                      </div>
                      <div className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        {session.templateName || '未命名模板'} / {session.durationMin || 0} 分钟 / {session.completedSets} 组
                      </div>
                      <div className="mt-1 text-xs font-bold text-emerald-700">
                        有效组 {session.effectiveSets} / 总量 {formatWeight(session.totalVolumeKg, unitSettings)}
                      </div>
                    </div>
                  )) : <div className="rounded-lg bg-white p-4 text-sm text-slate-500">当天没有训练记录。</div>}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">重量单位</h2>
            <div className="grid grid-cols-2 gap-2 md:max-w-xs">
              {(['kg', 'lb'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => onUpdateUnitSettings({ weightUnit: unit })}
                  className={classNames(
                    'h-11 rounded-lg border text-sm font-black',
                    unitSettings.weightUnit === unit ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">历史数据内部仍按 kg 保存，切换单位只改变显示和输入方式。</p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">历史记录</h2>
            <div className="space-y-2">
              {rawHistory.slice(0, 10).map((session) => (
                <div key={session.id} className="flex flex-col gap-2 rounded-lg bg-stone-50 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-black text-slate-950">
                      {session.templateName}
                      {session.dataFlag === 'test' ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">测试</span> : null}
                      {session.dataFlag === 'excluded' ? <span className="rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-600">排除</span> : null}
                    </div>
                    <div className="text-sm text-slate-500">
                      {session.date} / {sessionCompletedSets(session)} 组 / {session.durationMin || 0} 分钟
                    </div>
                    <details className="mt-2 text-sm text-slate-600">
                      <summary className="cursor-pointer font-black text-slate-700">查看训练详情</summary>
                      <div className="mt-2 space-y-1">
                        {session.exercises.map((exercise) => (
                          <div key={`${session.id}-${exercise.id}`} className="rounded-md bg-white px-3 py-2">
                            <div className="font-black text-slate-900">{exercise.alias || exercise.name}</div>
                            <div className="text-xs font-bold text-slate-500">
                              {Array.isArray(exercise.sets)
                                ? exercise.sets
                                    .filter((set) => set.done)
                                    .map((set) => `${formatWeight(set.weight, unitSettings)} x ${set.reps}${set.rir !== undefined && set.rir !== '' ? ` / RIR ${set.rir}` : ''}${set.painFlag ? ' / 不适' : ''}`)
                                    .join('；') || '未完成'
                                : '未记录'}
                            </div>
                          </div>
                        ))}
                        {(session.supportExerciseLogs || []).length ? (
                          <div className="rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-500">
                            辅助动作：{(session.supportExerciseLogs || []).map((log) => `${log.exerciseName || log.exerciseId} ${log.completedSets}/${log.plannedSets}${log.skippedReason ? ` / 已跳过` : ''}`).join('；')}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-black text-emerald-700">{formatWeight(sessionVolume(session), unitSettings)}</div>
                    <button type="button" onClick={() => onMarkSessionDataFlag(session.id, session.dataFlag === 'test' ? 'normal' : 'test')} className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-black text-amber-700">
                      {session.dataFlag === 'test' ? '恢复正式' : '标记测试'}
                    </button>
                    <button type="button" onClick={() => onDeleteSession(session.id)} className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700">
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {!rawHistory.length ? <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">还没有历史训练。</div> : null}
            </div>
          </section>
        </section>
      </div>
        )
      ) : null}
    </Page>
  );
}
