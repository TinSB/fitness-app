import React from 'react';
import { Activity, BarChart3, Copy, Download, Save } from 'lucide-react';
import { EXERCISE_DISPLAY_NAMES } from '../data/exerciseLibrary';
import {
  CORE_TREND_EXERCISES,
  buildAdherenceReport,
  buildDeloadSignal,
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
import {
  buildE1RMProfile,
  buildEffectiveVolumeSummary,
  buildLoadFeedbackSummary,
  buildAdjustmentDiff,
  createAdjustmentDraftFromRecommendations,
  reviewAdjustmentEffect,
  buildSessionSummaryExplanations,
  buildWeeklyActionExplanation,
  buildWeeklyActionRecommendations,
  buildWeeklyCoachReview,
  formatExplanationEvidence,
  formatExplanationItem,
  formatDate,
  getCurrentMesocycleWeek,
  number,
  sessionCompletedSets,
  sessionVolume,
  todayKey,
} from '../engines/trainingEngine';
import {
  formatAdherenceConfidence,
  formatComplexityLevel,
  formatPainAction,
  formatPersonalRecordQuality,
  formatSkippedReason,
  formatSupportDoseAdjustment,
  formatWeeklyActionCategory,
  formatWeeklyActionPriority,
} from '../i18n/formatters';
import type { AppData, ProgramAdjustmentDraft, WeeklyPrescription } from '../models/training-model';
import { exportAppData, getBackupFileName, importAppData } from '../storage/backup';
import { Page, Stat, WeeklyPrescriptionCard } from '../ui/common';
import { Term } from '../ui/Term';

interface ProgressViewProps {
  data: AppData;
  weeklyPrescription: WeeklyPrescription;
  bodyWeightInput: string;
  setBodyWeightInput: React.Dispatch<React.SetStateAction<string>>;
  onSaveBodyWeight: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreData: (data: AppData) => void;
  onApplyProgramAdjustmentDraft: (draft: ProgramAdjustmentDraft) => void;
  onRollbackProgramAdjustment: (historyItemId: string) => void;
}

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

const riskLabels = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const;

const riskClasses = {
  low: 'bg-emerald-50 text-emerald-800',
  medium: 'bg-amber-50 text-amber-800',
  high: 'bg-rose-50 text-rose-800',
} as const;

const previewChangeLabels = {
  add_sets: '增加组数',
  remove_sets: '减少组数',
  swap_exercise: '替代动作',
  reduce_support: '减少辅助层',
  increase_support: '增加辅助层',
  keep: '维持',
} as const;

export function ProgressView({
  data,
  weeklyPrescription,
  bodyWeightInput,
  setBodyWeightInput,
  onSaveBodyWeight,
  onDeleteSession,
  onRestoreData,
  onApplyProgramAdjustmentDraft,
  onRollbackProgramAdjustment,
}: ProgressViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = React.useState('');
  const history = data.history || [];
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

  React.useEffect(() => {
    setSelectedActionIds(defaultSelectedActionIds);
    setPreviewDraft(null);
  }, [weeklyActionSignature, defaultSelectedActionIds]);

  const selectedActions = weeklyActions.filter((item) => selectedActionIds.includes(item.id));
  const adjustmentDiff = previewDraft && sourceTemplate ? buildAdjustmentDiff(previewDraft, sourceTemplate) : null;
  const adjustmentPreviews = previewDraft
    ? [{
        id: previewDraft.id,
        title: previewDraft.title,
        summary: previewDraft.summary,
        changes: previewDraft.changes,
        confidence: previewDraft.confidence,
      }]
    : [];
  const latestAdjustment = (data.programAdjustmentHistory || [])[0];
  const adjustmentReview = latestAdjustment
    ? reviewAdjustmentEffect(latestAdjustment, history.slice(2, 6), history.slice(0, 2))
    : null;
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

  const downloadBackup = () => downloadText(getBackupFileName(), exportAppData(data), 'application/json');

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
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

  return (
    <Page
      eyebrow="进度"
      title="长期训练回看"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadText(`ironpath-${todayKey()}.json`, JSON.stringify(data, null, 2), 'application/json')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            <Download className="h-4 w-4" />
            导出 JSON
          </button>
          <button
            type="button"
            onClick={() => downloadText(`ironpath-${todayKey()}.csv`, makeCsv(history), 'text/csv;charset=utf-8')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </button>
        </div>
      }
    >
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
                disabled={!sourceTemplate || !selectedActions.length}
                onClick={() => sourceTemplate && setPreviewDraft(createAdjustmentDraftFromRecommendations(selectedActions, sourceTemplate))}
                className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                生成调整预览
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
                    {preview.changes.map((change, index) => (
                      <div key={`${preview.id}-${index}`} className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                        <span className="font-black text-slate-950">{previewChangeLabels[change.type]}：</span>
                        {change.muscleId ? `${change.muscleId} ` : ''}
                        {change.exerciseId ? `${change.exerciseId} ` : ''}
                        {change.setsDelta ? `${change.setsDelta > 0 ? '+' : ''}${change.setsDelta} 组。` : ''}
                        {change.reason}
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
                      <span className="font-black text-slate-950">{previewChangeLabels[change.type]}</span>
                      <span className={`rounded-md px-2 py-1 text-xs font-black ${riskClasses[change.riskLevel]}`}>{riskLabels[change.riskLevel]}</span>
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
            {(data.programAdjustmentHistory || []).length ? (
              <div className="space-y-3">
                {(data.programAdjustmentHistory || []).slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg bg-stone-50 p-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-black text-slate-950">{item.appliedAt.slice(0, 10)} 实验模板</div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
                        {item.rollbackAvailable ? '可回滚' : '已回滚'}
                      </span>
                    </div>
                    <div className="mt-2 leading-6">
                      来源模板：{item.sourceProgramTemplateId}；实验模板：{item.experimentalProgramTemplateId}
                    </div>
                    <div className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      {item.changes.slice(0, 3).map((change) => change.reason).join(' / ') || '没有可自动应用的结构调整'}
                    </div>
                    {latestAdjustment?.id === item.id && adjustmentReview ? (
                      <div className="mt-2 rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                        复盘：{adjustmentReview.summary}
                      </div>
                    ) : null}
                    {item.rollbackAvailable ? (
                      <button
                        type="button"
                        onClick={() => onRollbackProgramAdjustment(item.id)}
                        className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"
                      >
                        回滚到原模板
                      </button>
                    ) : null}
                  </div>
                ))}
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
            <h2 className="mb-3 font-black text-slate-950">历史记录</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((session) => (
                <div key={session.id} className="flex flex-col gap-2 rounded-lg bg-stone-50 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black text-slate-950">{session.templateName}</div>
                    <div className="text-sm text-slate-500">
                      {session.date} / {sessionCompletedSets(session)} 组 / {session.durationMin || 0} 分钟
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-black text-emerald-700">{Math.round(sessionVolume(session))}kg</div>
                    <button type="button" onClick={() => onDeleteSession(session.id)} className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700">
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {!history.length ? <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">还没有历史训练。</div> : null}
            </div>
          </section>
        </section>
      </div>
    </Page>
  );
}
