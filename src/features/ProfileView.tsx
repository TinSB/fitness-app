import React from 'react';
import { Activity, Database, Download, HardDrive, Ruler, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import { downloadText, makeCsv } from '../engines/analytics';
import type { CoachAutomationSummary } from '../engines/coachAutomationEngine';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { todayKey } from '../engines/engineUtils';
import { formatGoal } from '../i18n/formatters';
import type { AppData, UnitSettings } from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ListItem } from '../ui/ListItem';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { HealthDataPanel } from './HealthDataPanel';

interface ProfileViewProps {
  data: AppData;
  unitSettings: UnitSettings;
  coachAutomationSummary?: CoachAutomationSummary;
  onUpdateUnitSettings: (updates: Partial<UnitSettings>) => void;
  onRestoreData: (data: AppData) => void;
  onUpdateHealthData: (data: AppData) => void;
  onOpenAssessment: () => void;
  onOpenRecordData: () => void;
}

type PendingRestore = {
  fileName: string;
  data: AppData;
};

const Notice = ({
  tone = 'slate',
  title,
  children,
  className = '',
}: {
  tone?: 'slate' | 'emerald' | 'rose' | 'amber';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const tones = {
    slate: 'border-slate-200 bg-stone-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${tones[tone]} ${className}`}>
      {title ? <span className="mr-1 font-semibold">{title}</span> : null}
      {children}
    </div>
  );
};

export function ProfileView({
  data,
  unitSettings,
  coachAutomationSummary,
  onUpdateUnitSettings,
  onRestoreData,
  onUpdateHealthData,
  onOpenAssessment,
  onOpenRecordData,
}: ProfileViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = React.useState('');
  const [pendingRestore, setPendingRestore] = React.useState<PendingRestore | null>(null);
  const analyticsHistory = filterAnalyticsHistory(data.history || []);
  const normalSessionCount = analyticsHistory.length;
  const testSessionCount = (data.history || []).filter((session) => session.dataFlag === 'test').length;
  const healthBatchCount = data.healthImportBatches?.length || 0;
  const dataHealth = coachAutomationSummary?.dataHealth;
  const dataHealthTone = dataHealth?.status === 'has_errors' ? 'rose' : dataHealth?.status === 'has_warnings' ? 'amber' : 'emerald';
  const dataHealthLabel = dataHealth?.status === 'has_errors' ? '需要处理' : dataHealth?.status === 'has_warnings' ? '建议复查' : '健康';

  const downloadBackup = () => {
    downloadText(`ironpath-${todayKey()}.json`, JSON.stringify(data, null, 2), 'application/json');
    setMessage('已导出 JSON 备份。');
  };

  const downloadCsv = () => {
    downloadText(`ironpath-${todayKey()}.csv`, makeCsv(analyticsHistory), 'text/csv;charset=utf-8');
    setMessage('已导出 CSV 训练记录。');
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      setPendingRestore({ fileName: file.name, data: parsed });
      setMessage('');
    } catch {
      setMessage('导入失败，请确认文件是 IronPath JSON 备份。');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    onRestoreData(pendingRestore.data);
    setPendingRestore(null);
    setMessage('已导入备份。');
  };

  return (
    <ResponsivePageLayout>
      <PageHeader
        eyebrow="我的"
        title="设置中心"
        description="管理个人资料、筛查、单位、健康数据、备份恢复和本地 PWA 说明。"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="space-y-4">
          <PageSection title="个人数据状态" description="这里只显示设置和数据状态，不展示今日训练建议。">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard label="正式训练" value={`${normalSessionCount} 次`} tone="emerald" />
              <MetricCard label="测试训练" value={`${testSessionCount} 次`} tone={testSessionCount ? 'amber' : 'slate'} />
              <MetricCard label="健康导入批次" value={`${healthBatchCount} 批`} />
            </div>
            <Card className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="emerald">{formatGoal(data.userProfile?.primaryGoal || data.programTemplate?.primaryGoal)}</StatusBadge>
                <StatusBadge tone="slate">{unitSettings.weightUnit}</StatusBadge>
              </div>
              <div className="text-sm leading-6 text-slate-600">
                {data.userProfile?.name || 'anonymous'} · 每周 {data.userProfile?.weeklyTrainingDays || data.programTemplate?.daysPerWeek || 0} 天 · 每次约 {data.userProfile?.sessionDurationMin || 60} 分钟
              </div>
            </Card>
          </PageSection>

          <PageSection title="筛查" description="身体资料、体态筛查和动作受限入口。">
            <Card>
              <ListItem
                title="身体 / 动作筛查"
                description="管理训练目标、体态问题、动作限制和疼痛触发。"
                meta="低频设置，不放在训练页。"
                action={
                  <ActionButton variant="primary" onClick={onOpenAssessment}>
                    <ShieldCheck className="h-4 w-4" />
                    打开筛查
                  </ActionButton>
                }
              />
            </Card>
          </PageSection>

          <PageSection title="单位设置" description="切换只影响界面显示和输入，历史训练内部仍按 kg 标准化保存。">
            <Card className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['kg', 'lb'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => onUpdateUnitSettings({ weightUnit: unit })}
                    className={[
                      'min-h-12 rounded-lg border text-base font-semibold transition',
                      unitSettings.weightUnit === unit ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
                    ].join(' ')}
                  >
                    {unit === 'kg' ? 'kg 公斤' : 'lb 磅'}
                  </button>
                ))}
              </div>
              <Notice title="说明">
                e1RM、PR 和训练量内部仍统一计算，界面会按你选择的单位显示。
              </Notice>
            </Card>
          </PageSection>
        </section>

        <section className="space-y-4">
          <PageSection title="健康数据导入" description="手动导入 CSV / JSON / Apple Health export.xml，用于恢复和活动负荷参考。">
            <HealthDataPanel data={data} onUpdateData={onUpdateHealthData} />
          </PageSection>

          {dataHealth ? (
            <PageSection title="数据健康检查" description="自动发现历史记录、替代动作、单位和健康导入中的潜在异常。">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{dataHealth.summary}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">这里只报告问题，不会自动删除、修正或覆盖任何数据。</div>
                  </div>
                  <StatusBadge tone={dataHealthTone}>{dataHealthLabel}</StatusBadge>
                </div>
                {dataHealth.issues.length ? (
                  <div className="space-y-2">
                    {dataHealth.issues.map((issue) => (
                      <div key={issue.id} className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">{issue.title}</span>
                          <StatusBadge tone={issue.severity === 'error' ? 'rose' : issue.severity === 'warning' ? 'amber' : 'slate'}>
                            {issue.severity === 'error' ? '需要处理' : issue.severity === 'warning' ? '建议复查' : '提示'}
                          </StatusBadge>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">{issue.message}</div>
                        {issue.suggestedAction ? <div className="mt-1 text-xs font-semibold leading-5 text-slate-700">{issue.suggestedAction}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Notice tone="emerald">未发现明显数据异常。</Notice>
                )}
              </Card>
            </PageSection>
          ) : null}

          <PageSection title="自动化设置" description="教练自动化只生成建议，不会自动覆盖计划或修改历史。">
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="emerald">可忽略</StatusBadge>
                <StatusBadge tone="slate">需用户确认</StatusBadge>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                今日调整、下次训练和数据健康提醒会优先显示最重要内容。采用建议、修正记录或调整计划仍由你手动确认。
              </p>
            </Card>
          </PageSection>

          <PageSection title="备份与恢复" description="这是全局应用数据备份，和记录页的单次训练数据管理分开。">
            <Card className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <ActionButton variant="secondary" onClick={downloadBackup}>
                  <Download className="h-4 w-4" />
                  导出 JSON
                </ActionButton>
                <ActionButton variant="secondary" onClick={downloadCsv}>
                  <Activity className="h-4 w-4" />
                  导出 CSV
                </ActionButton>
                <ActionButton variant="danger" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  导入恢复
                </ActionButton>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleImportFile(event.target.files?.[0])}
              />
              <Notice tone="amber" title="恢复会覆盖当前本地数据。">
                导入 JSON 备份前建议先导出现有备份。确认后会替换当前浏览器里的 IronPath 数据。
              </Notice>
              {message ? <Notice tone={message.includes('失败') ? 'rose' : 'emerald'}>{message}</Notice> : null}
              <ActionButton variant="ghost" size="sm" onClick={onOpenRecordData}>
                <Database className="h-4 w-4" />
                管理单次训练记录
              </ActionButton>
            </Card>
          </PageSection>

          <PageSection title="PWA / 本地数据说明" description="IronPath Web/PWA 默认使用当前浏览器本地存储。">
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  添加到主屏幕
                </div>
                <p className="text-sm leading-6 text-slate-600">iPhone Safari 打开后，可通过分享菜单添加到主屏幕，作为本地训练工具使用。</p>
              </Card>
              <Card>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <HardDrive className="h-4 w-4 text-emerald-600" />
                  本地数据
                </div>
                <p className="text-sm leading-6 text-slate-600">训练记录保存在当前浏览器。换设备或清理 Safari 数据前，请先导出 JSON 备份。</p>
              </Card>
            </div>
          </PageSection>

          <PageSection title="关于 IronPath" description="私人力量训练系统。">
            <Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-stone-50 p-3 text-sm">
                  <Ruler className="mb-2 h-4 w-4 text-emerald-600" />
                  <div className="font-semibold text-slate-950">单位</div>
                  <div className="mt-1 text-slate-500">{unitSettings.weightUnit}</div>
                </div>
                <div className="rounded-lg bg-stone-50 p-3 text-sm">
                  <HardDrive className="mb-2 h-4 w-4 text-emerald-600" />
                  <div className="font-semibold text-slate-950">历史</div>
                  <div className="mt-1 text-slate-500">{data.history?.length || 0} 次训练</div>
                </div>
                <div className="rounded-lg bg-stone-50 p-3 text-sm">
                  <Smartphone className="mb-2 h-4 w-4 text-emerald-600" />
                  <div className="font-semibold text-slate-950">版本</div>
                  <div className="mt-1 text-slate-500">本地 PWA</div>
                </div>
              </div>
              <Notice className="mt-3" title="边界">
                IronPath 用于训练记录、计划管理和恢复参考，不替代医疗诊断或康复治疗。
              </Notice>
            </Card>
          </PageSection>
        </section>
      </div>

      {pendingRestore ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/30 p-4">
          <ConfirmDialog
            title="导入并恢复备份？"
            description={`将使用 ${pendingRestore.fileName} 覆盖当前浏览器里的 IronPath 数据。此操作会替换当前本地数据，建议确认已导出现有备份。`}
            confirmLabel="确认恢复"
            danger
            onCancel={() => setPendingRestore(null)}
            onConfirm={confirmRestore}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
