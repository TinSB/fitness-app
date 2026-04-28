import React from 'react';
import { CalendarDays, Database, Download, Trash2 } from 'lucide-react';
import { buildMonthStats, buildPrs, downloadText, makeCsv } from '../engines/analytics';
import { buildEffectiveVolumeSummary } from '../engines/effectiveSetEngine';
import { classNames, formatDate, sessionCompletedSets, sessionVolume, todayKey } from '../engines/engineUtils';
import { filterAnalyticsHistory, listSessionHistory, type SessionHistoryFilter } from '../engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../engines/trainingCalendarEngine';
import { formatExerciseName, formatPersonalRecordQuality, formatTechniqueQuality } from '../i18n/formatters';
import { formatTrainingVolume, formatWeight } from '../engines/unitConversionEngine';
import type { AppData, SessionDataFlag, TrainingSession, UnitSettings, WeeklyPrescription } from '../models/training-model';
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
  initialSection?: RecordSectionId;
  selectedSessionId?: string;
  selectedDate?: string;
}

type RecordSectionId = 'calendar' | 'history' | 'dashboard' | 'pr' | 'data';

const recordSections: Array<{ id: RecordSectionId; label: string; mobileLabel: string }> = [
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

const formatSessionTime = (session: TrainingSession) => {
  if (!session.startedAt) return '未记录时间';
  const started = new Date(session.startedAt);
  if (Number.isNaN(started.getTime())) return '未记录时间';
  const startText = started.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (!session.finishedAt) return startText;
  const finished = new Date(session.finishedAt);
  if (Number.isNaN(finished.getTime())) return startText;
  return `${startText} - ${finished.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
};

const dataFlagLabel = (flag?: SessionDataFlag) => {
  if (flag === 'test') return '测试';
  if (flag === 'excluded') return '排除';
  return '正常';
};

export function RecordView({
  data,
  unitSettings,
  bodyWeightInput,
  setBodyWeightInput,
  onSaveBodyWeight,
  onDeleteSession,
  onMarkSessionDataFlag,
  onUpdateUnitSettings,
  onRestoreData,
  onStartTraining,
  initialSection,
  selectedSessionId,
  selectedDate,
}: RecordViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activeSection, setActiveSection] = React.useState<RecordSectionId>(initialSection || 'calendar');
  const [historyFilter, setHistoryFilter] = React.useState<SessionHistoryFilter>('all');
  const [selectedDateKey, setSelectedDateKey] = React.useState(selectedDate || todayKey());
  const [selectedSession, setSelectedSession] = React.useState<TrainingSession | null>(null);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = React.useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = React.useState('');
  const rawHistory = data.history || [];
  const analyticsHistory = filterAnalyticsHistory(rawHistory);
  const sortedHistory = React.useMemo(() => listSessionHistory(rawHistory, historyFilter), [rawHistory, historyFilter]);
  const calendar = React.useMemo(
    () =>
      buildTrainingCalendar(rawHistory, undefined, {
        importedWorkouts: data.importedWorkoutSamples || [],
        includeExternalWorkouts: data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar !== false,
      }),
    [rawHistory, data.importedWorkoutSamples, data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar],
  );
  const selectedCalendarDay =
    calendar.days.find((day) => day.date === selectedDateKey) ||
    calendar.days.find((day) => day.totalSessions > 0 || day.totalExternalWorkouts > 0);
  const prs = buildPrs(analyticsHistory);
  const monthStats = buildMonthStats(analyticsHistory, data.bodyWeights || []);
  const effectiveSummary = buildEffectiveVolumeSummary(analyticsHistory);
  const monthSessionCount = calendar.days.reduce((sum, day) => sum + day.totalSessions, 0);
  const recentWeeks = calendar.weeklyFrequency.slice(-4);
  const currentWeekCount = recentWeeks[recentWeeks.length - 1]?.sessionCount || 0;
  const recentWeekAverage = recentWeeks.length
    ? recentWeeks.reduce((sum, week) => sum + week.sessionCount, 0) / recentWeeks.length
    : 0;

  React.useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
    if (selectedDate) {
      setSelectedDateKey(selectedDate);
      setActiveSection(initialSection || 'calendar');
    }
    if (selectedSessionId) {
      const next = rawHistory.find((session) => session.id === selectedSessionId) || null;
      setSelectedSession(next);
      setActiveSection(initialSection || 'history');
    }
  }, [initialSection, selectedDate, selectedSessionId, rawHistory]);

  const openSession = (sessionId: string) => {
    setSelectedSession(rawHistory.find((session) => session.id === sessionId) || null);
  };

  const renderFlagBadge = (flag?: SessionDataFlag) => (
    <StatusBadge tone={flag === 'test' ? 'amber' : flag === 'excluded' ? 'slate' : 'emerald'}>{dataFlagLabel(flag)}</StatusBadge>
  );

  const downloadBackup = async () => {
    const { exportAppData, getBackupFileName } = await import('../storage/backup');
    downloadText(getBackupFileName(), exportAppData(data), 'application/json');
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    const { importAppData } = await import('../storage/backup');
    const result = importAppData(await file.text());
    if (!result.ok || !result.data) {
      setRestoreMessage(result.error || '导入失败，当前数据没有被覆盖。');
      return;
    }
    if (!window.confirm('确定导入这个备份吗？当前本地数据会被替换。')) return;
    onRestoreData(result.data);
    setRestoreMessage('导入成功，数据已恢复。');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderCalendar = () => (
    <PageSection
      title="训练日历"
      description="按本地日期回看训练频率、当天训练和外部活动。"
      action={onStartTraining ? <ActionButton onClick={onStartTraining}>开始训练</ActionButton> : undefined}
    >
      {!rawHistory.length ? (
        <EmptyState
          title="暂无训练记录"
          description="完成一次训练后，这里会自动显示训练日历和历史详情。"
          action={onStartTraining ? <ActionButton onClick={onStartTraining}>开始训练</ActionButton> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="本周训练" value={`${currentWeekCount} 次`} tone="emerald" />
            <MetricCard label="本月训练" value={`${monthSessionCount} 次`} />
            <MetricCard label="近 4 周频率" value={`${recentWeekAverage.toFixed(1)} 次/周`} />
          </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <Card>
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>{calendar.month}</span>
              <span>本月 {monthSessionCount} 次</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
              {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
                <div key={label}>{label}</div>
              ))}
              {calendar.days.map((day) => {
                const selected = selectedCalendarDay?.date === day.date;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDateKey(day.date)}
                    className={classNames(
                      'min-h-12 rounded-lg border px-1 py-2 text-xs font-semibold',
                      selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-stone-50 text-slate-600',
                    )}
                  >
                    <div>{Number(day.date.slice(-2))}</div>
                    {day.totalSessions ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                    {day.totalExternalWorkouts ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}
                    {day.hasPainFlags ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-950">{selectedCalendarDay?.date || '选择日期'}</div>
                <div className="text-xs text-slate-500">当天训练与外部活动</div>
              </div>
              <CalendarDays className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-2">
              {(selectedCalendarDay?.sessions || []).map((session) => (
                <ListItem
                  key={session.sessionId}
                  title={session.title}
                  description={`${session.templateName || '未命名模板'} / ${session.completedSets} 组 / ${formatTrainingVolume(session.totalVolumeKg, unitSettings)}`}
                  meta={session.isExperimentalTemplate ? '实验模板' : undefined}
                  action={<ActionButton size="sm" variant="secondary" onClick={() => openSession(session.sessionId)}>详情</ActionButton>}
                />
              ))}
              {(selectedCalendarDay?.externalWorkouts || []).map((workout) => (
                <ListItem
                  key={workout.workoutId}
                  title={`外部活动：${workout.workoutType}`}
                  description={`${Math.round(workout.durationMin || 0)} 分钟${workout.activeEnergyKcal ? ` / ${Math.round(workout.activeEnergyKcal)} kcal` : ''}`}
                  meta="不计入力量训练 PR / e1RM"
                />
              ))}
              {!(selectedCalendarDay?.sessions || []).length && !(selectedCalendarDay?.externalWorkouts || []).length ? (
                <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">当天没有记录。</div>
              ) : null}
            </div>
          </Card>
        </div>
        </div>
      )}
    </PageSection>
  );

  const renderHistory = () => (
    <PageSection title="历史训练" description="按时间倒序查看、删除或标记测试数据。">
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
        <EmptyState title="暂无匹配记录" description="切换筛选或完成一次训练后，这里会显示历史详情。" />
      ) : (
        <div className="space-y-2">
          {sortedHistory.map((session) => (
            <ListItem
              key={session.id}
              title={session.templateName || session.focus || '未命名训练'}
              description={`${session.date} / ${formatSessionTime(session)} / ${sessionCompletedSets(session)} 组 / ${formatTrainingVolume(sessionVolume(session), unitSettings)}`}
              meta={session.isExperimentalTemplate ? '实验模板' : undefined}
              action={
                <div className="flex shrink-0 items-center gap-2">
                  {renderFlagBadge(session.dataFlag)}
                  <ActionButton size="sm" variant="secondary" onClick={() => setSelectedSession(session)}>详情</ActionButton>
                </div>
              }
            />
          ))}
        </div>
      )}
    </PageSection>
  );

  const renderDashboard = () => (
    <PageSection title="统计" description="这里只统计正常训练数据，测试/排除数据不会进入分析。">
      {!analyticsHistory.length ? (
        <EmptyState title="统计数据不足" description="完成训练后会自动生成训练频率、有效组和训练量统计。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="本月训练" value={`${monthStats.monthSessions.length} 次`} />
          <MetricCard label="本月总量" value={formatTrainingVolume(monthStats.monthVolume, unitSettings)} />
          <MetricCard label="有效组" value={`${effectiveSummary.effectiveSets}`} />
          <MetricCard label="高置信有效组" value={`${effectiveSummary.highConfidenceEffectiveSets}`} />
        </div>
      )}
    </PageSection>
  );

  const renderPr = () => (
    <PageSection title="PR / e1RM" description="PR 与 e1RM 使用实际执行动作独立统计。">
      {!prs.length ? (
        <EmptyState title="暂无 PR 数据" description="需要更多高质量训练记录后，系统会自动生成个人记录。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {prs.map((pr) => (
            <Card key={pr.key}>
              <div className="text-xs font-semibold text-slate-500">{pr.type}</div>
              <div className="mt-1 font-semibold text-slate-950">{pr.exercise}</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{pr.displayValue}</div>
              <div className="mt-2 inline-flex rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-slate-600">{formatPersonalRecordQuality(pr.quality)}</div>
              <div className="mt-1 text-xs text-slate-500">{pr.date}</div>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  );

  const renderData = () => (
    <PageSection title="数据管理" description="备份、恢复、导出和单位设置都在这里。">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
            <Database className="h-5 w-5 text-emerald-600" />
            备份与恢复
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <ActionButton onClick={downloadBackup} variant="primary">
              <Download className="h-4 w-4" />
              导出 JSON
            </ActionButton>
            <ActionButton onClick={() => downloadText(`ironpath-${todayKey()}.csv`, makeCsv(analyticsHistory), 'text/csv;charset=utf-8')} variant="secondary">
              导出 CSV
            </ActionButton>
            <ActionButton onClick={() => fileInputRef.current?.click()} variant="secondary">
              导入备份
            </ActionButton>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => handleImportFile(event.target.files?.[0])} />
          {restoreMessage ? <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm font-semibold text-slate-600">{restoreMessage}</div> : null}
        </Card>
        <Card>
          <div className="mb-3 font-semibold text-slate-950">单位设置</div>
          <div className="grid grid-cols-2 gap-2">
            {(['kg', 'lb'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => onUpdateUnitSettings({ weightUnit: unit })}
                className={classNames(
                  'min-h-11 rounded-lg border text-sm font-semibold',
                  unitSettings.weightUnit === unit ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <input
              type="number"
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-base"
              value={bodyWeightInput}
              placeholder="记录体重"
              onChange={(event) => setBodyWeightInput(event.target.value)}
            />
            <ActionButton onClick={onSaveBodyWeight} variant="secondary">保存</ActionButton>
          </div>
        </Card>
      </div>
    </PageSection>
  );

  const renderSessionDrawer = () => (
    <Drawer open={Boolean(selectedSession)} title="训练详情" onClose={() => setSelectedSession(null)}>
      {selectedSession ? (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-slate-950">{selectedSession.templateName || selectedSession.focus || '训练详情'}</div>
              {renderFlagBadge(selectedSession.dataFlag)}
              {selectedSession.isExperimentalTemplate ? <StatusBadge tone="amber">实验模板</StatusBadge> : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">{selectedSession.date} / {formatSessionTime(selectedSession)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricCard label="完成组数" value={`${sessionCompletedSets(selectedSession)}`} />
              <MetricCard label="总量" value={formatTrainingVolume(sessionVolume(selectedSession), unitSettings)} />
            </div>
          </Card>
          <PageSection title="主训练动作">
            {(selectedSession.exercises || []).map((exercise) => (
              <Card key={`${selectedSession.id}-${exercise.id}`} className="space-y-2">
                <div className="font-semibold text-slate-950">{formatExerciseName(exercise)}</div>
                {exercise.originalExerciseId && exercise.actualExerciseId && exercise.originalExerciseId !== exercise.actualExerciseId ? (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    原计划：{formatExerciseName(exercise.originalExerciseId)} / 实际执行：{formatExerciseName(exercise.actualExerciseId)}
                  </div>
                ) : null}
                <div className="space-y-1 text-xs font-semibold text-slate-600">
                  {(Array.isArray(exercise.sets) ? exercise.sets : []).map((set, index) => (
                    <div key={set.id || `${exercise.id}-${index}`} className="rounded-md bg-stone-50 px-3 py-2">
                      {set.type === 'warmup' ? '热身' : '正式'} {index + 1}：{formatWeight(set.weight, unitSettings)} x {set.reps}
                      {set.rir !== undefined && set.rir !== '' ? ` / RIR ${set.rir}` : ''}
                      {set.techniqueQuality ? ` / ${formatTechniqueQuality(set.techniqueQuality)}` : ''}
                      {set.painFlag ? ' / 不适' : ''}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </PageSection>
          {(selectedSession.supportExerciseLogs || []).length ? (
            <PageSection title="纠偏 / 功能补丁">
              {(selectedSession.supportExerciseLogs || []).map((log) => (
                <ListItem
                  key={`${log.moduleId}-${log.exerciseId}`}
                  title={log.exerciseName || log.exerciseId}
                  description={`${log.completedSets}/${log.plannedSets} 组${log.skippedReason ? ' / 已跳过' : ''}`}
                />
              ))}
            </PageSection>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <ActionButton variant="danger" onClick={() => selectedSession && setPendingDeleteSessionId(selectedSession.id)}>
              <Trash2 className="h-4 w-4" />
              删除记录
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => selectedSession && onMarkSessionDataFlag(selectedSession.id, selectedSession.dataFlag === 'test' ? 'normal' : 'test')}>
              {selectedSession.dataFlag === 'test' ? '恢复正常' : '标记测试'}
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => selectedSession && onMarkSessionDataFlag(selectedSession.id, 'excluded')}>
              排除统计
            </ActionButton>
          </div>
        </div>
      ) : null}
    </Drawer>
  );

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="记录" title="训练记录中心" description="先看日历，再回看历史、统计和 PR。测试数据可查看，但不会进入分析。" />
      <div className="space-y-4">
        <SegmentedControl value={activeSection} options={recordSections} onChange={setActiveSection} ariaLabel="记录中心分区" />
        {activeSection === 'calendar' ? renderCalendar() : null}
        {activeSection === 'history' ? renderHistory() : null}
        {activeSection === 'dashboard' ? renderDashboard() : null}
        {activeSection === 'pr' ? renderPr() : null}
        {activeSection === 'data' ? renderData() : null}
      </div>
      {renderSessionDrawer()}
      {pendingDeleteSessionId ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/30 p-4">
          <ConfirmDialog
            title="删除训练记录？"
            description="删除后该训练不会计入记录、PR、e1RM、完成度和日历。此操作不可恢复，建议先导出备份。"
            confirmLabel="删除"
            danger
            onCancel={() => setPendingDeleteSessionId(null)}
            onConfirm={() => {
              onDeleteSession(pendingDeleteSessionId);
              setSelectedSession(null);
              setPendingDeleteSessionId(null);
            }}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
