import React from 'react';
import { Activity, BarChart3, Copy, Download, Save } from 'lucide-react';
import {
  buildAdherenceReport,
  buildDeloadSignal,
  buildExerciseTrend,
  buildMonthStats,
  buildPrs,
  buildRecentSessionBars,
  buildWeeklyReport,
  CORE_TREND_EXERCISES,
  downloadText,
  makeCsv,
  trendStatus,
} from '../engines/analytics';
import { buildAdherenceAdjustment } from '../engines/adherenceAdjustmentEngine';
import { buildPainPatterns } from '../engines/painPatternEngine';
import { buildSessionSummaryExplanations, buildWeeklyCoachReview, formatDate, sessionCompletedSets, sessionVolume, todayKey } from '../engines/trainingEngine';
import type { AppData, WeeklyPrescription } from '../models/training-model';
import { exportAppData, getBackupFileName, importAppData } from '../storage/backup';
import { Page, Stat, WeeklyPrescriptionCard } from '../ui/common';

interface ProgressViewProps {
  data: AppData;
  weeklyPrescription: WeeklyPrescription;
  bodyWeightInput: string;
  setBodyWeightInput: React.Dispatch<React.SetStateAction<string>>;
  onSaveBodyWeight: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreData: (data: AppData) => void;
}

const painActionLabels: Record<string, string> = {
  watch: '观察',
  substitute: '优先替代',
  deload: '减量',
  seek_professional: '建议找专业帮助',
};

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

const templateLabel = (id: string, fallback: string) => templateNameLabels[id] || fallback;

export function ProgressView({ data, weeklyPrescription, bodyWeightInput, setBodyWeightInput, onSaveBodyWeight, onDeleteSession, onRestoreData }: ProgressViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = React.useState('');
  const history = data.history || [];
  const monthStats = buildMonthStats(history, data.bodyWeights || []);
  const prs = buildPrs(history);
  const barData = buildRecentSessionBars(history);
  const weeklyReport = buildWeeklyReport(history, data.bodyWeights || []);
  const coreTrends = CORE_TREND_EXERCISES.map((item) => ({ ...item, trend: buildExerciseTrend(history, item.id) }));
  const deloadSignal = buildDeloadSignal(data);
  const adherenceReport = buildAdherenceReport(history);
  const adherenceAdjustment = buildAdherenceAdjustment(adherenceReport, data.programTemplate, data.screeningProfile?.adaptiveState);
  const painPatterns = buildPainPatterns(history).slice(0, 6);
  const latestSession = history[0];
  const latestSessionSummary = latestSession
    ? buildSessionSummaryExplanations({
        session: latestSession,
        adherenceReport,
        adherenceAdjustment,
        painPatterns,
      })
    : [];
  const weeklyCoachReview = buildWeeklyCoachReview({
    history,
    weeklyPrescription,
    adherenceReport,
    adherenceAdjustment,
    painPatterns,
    plannedSessionsPerWeek: data.programTemplate?.daysPerWeek || data.userProfile?.weeklyTrainingDays || 4,
  });

  const downloadBackup = () => {
    downloadText(getBackupFileName(), exportAppData(data), 'application/json');
  };

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
      title="长期进度"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadText(`ironpath-${todayKey()}.json`, JSON.stringify(data, null, 2), 'application/json')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            <Download className="h-4 w-4" />
            导出 JSON
          </button>
          <button
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
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">Session Summary</div>
                <h2 className="mt-1 font-black text-slate-950">最近一次训练总结</h2>
              </div>
              {latestSession ? <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">{templateLabel(latestSession.templateId, latestSession.templateName)}</span> : null}
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">Weekly Coach Review</div>
              <h2 className="mt-1 font-black text-slate-950">每周教练总结</h2>
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
            <h2 className="mb-3 font-black text-slate-950">完成度如何影响下周</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">复杂度</div>
                <div className="mt-1 text-lg font-black text-slate-950">{adherenceAdjustment.complexityLevel}</div>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">周训练量倍率</div>
                <div className="mt-1 text-lg font-black text-slate-950">{Math.round(adherenceAdjustment.weeklyVolumeMultiplier * 100)}%</div>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">纠偏剂量</div>
                <div className="mt-1 text-lg font-black text-slate-950">{adherenceAdjustment.correctionDoseAdjustment}</div>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <div className="text-xs font-black text-slate-500">功能补丁</div>
                <div className="mt-1 text-lg font-black text-slate-950">{adherenceAdjustment.functionalDoseAdjustment}</div>
              </div>
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
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
              />
              <button onClick={onSaveBodyWeight} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white">
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
              <button onClick={downloadBackup} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
                导出完整备份
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                导入备份 JSON
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
            {restoreMessage ? <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm font-bold text-slate-700">{restoreMessage}</div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">周报文案</h2>
            <div className="rounded-lg bg-slate-950 p-4 text-white">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-300">IronPath Weekly</div>
              <div className="mt-3 whitespace-pre-line text-sm leading-6">{weeklyReport}</div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(weeklyReport)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
            >
              <Copy className="h-4 w-4" />
              复制周报
            </button>
          </section>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="本月总训练量" value={`${Math.round(monthStats.monthVolume)}kg`} tone="emerald" />
            <Stat label="历史训练" value={`${history.length} 次`} />
            <Stat label="历史完成组数" value={history.reduce((sum, session) => sum + sessionCompletedSets(session), 0)} tone="amber" />
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

          <section className={deloadSignal.triggered ? 'rounded-lg border border-rose-200 bg-rose-50 p-4' : 'rounded-lg border border-slate-200 bg-white p-4'}>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">疲劳提醒</div>
            <h2 className="font-black text-slate-950">{deloadSignal.title}</h2>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-700">{deloadSignal.reasons.length ? deloadSignal.reasons.join(' / ') : '当前趋势还没有触发自动减量。'}</div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">完成度分析</h2>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-black text-slate-600">
                最近 {adherenceReport.recentSessionCount} 次 / 可信度 {adherenceReport.confidence}
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
                <div className="text-sm font-bold text-slate-700">纠偏 {adherenceReport.correctionRate ?? '--'}%</div>
                <div className="text-sm font-bold text-slate-700">功能补丁 {adherenceReport.functionalRate ?? '--'}%</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-black text-slate-950">经常跳过的主动作：</span>
                {adherenceReport.skippedExercises.length
                  ? adherenceReport.skippedExercises.map((item) => `${item.exerciseId} (${item.count})`).join(' / ')
                  : '暂无明显跳过动作'}
              </div>
              <div>
                <span className="font-black text-slate-950">经常掉队的 support 动作：</span>
                {adherenceReport.skippedSupportExercises.length
                  ? adherenceReport.skippedSupportExercises
                      .map((item) => `${item.exerciseId} (${item.count}${item.mostCommonReason ? ` / ${item.mostCommonReason}` : ''})`)
                      .join(' / ')
                  : '暂无明显掉队的 support 动作'}
              </div>
              <div className="space-y-2">
                {adherenceReport.suggestions.map((item) => (
                  <div key={item} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    {item}
                  </div>
                ))}
              </div>
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
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{painActionLabels[pattern.suggestedAction] || pattern.suggestedAction}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      区域：{pattern.area} / 频率 {pattern.frequency} / 平均强度 {pattern.severityAvg.toFixed(1)}
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
              <h2 className="font-black text-slate-950">PR 追踪</h2>
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            {prs.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {prs.map((pr) => (
                  <div key={pr.key} className="rounded-lg border border-slate-200 bg-stone-50 p-4">
                    <div className="text-xs font-black text-slate-500">{pr.type}</div>
                    <div className="mt-1 font-black text-slate-950">{pr.exercise}</div>
                    <div className="mt-2 text-2xl font-black text-emerald-700">{pr.value}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">{pr.date}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-6 text-center text-sm text-slate-500">先记录几次核心动作，PR 会自动生成。</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">历史记录</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((session) => (
                <div key={session.id} className="flex flex-col gap-2 rounded-lg bg-stone-50 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black text-slate-950">{templateLabel(session.templateId, session.templateName)}</div>
                    <div className="text-sm text-slate-500">
                      {session.date} / {sessionCompletedSets(session)} 组 / {session.durationMin || 0} 分钟
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-black text-emerald-700">{Math.round(sessionVolume(session))}kg</div>
                    <button onClick={() => onDeleteSession(session.id)} className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700">
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
