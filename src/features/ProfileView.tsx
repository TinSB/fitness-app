import React from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { downloadText, makeCsv } from '../engines/analytics';
import type { CoachAutomationSummary } from '../engines/coachAutomationEngine';
import type { CoachAction } from '../engines/coachActionEngine';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { todayKey } from '../engines/engineUtils';
import { buildDataHealthClaritySummary } from '../engines/dataHealthClaritySummary';
import { buildSettingsSafetySummary } from '../engines/settingsSafetySummary';
import { resolveThemePreference, type ThemePreferenceMode, type ThemePreferenceResult } from '../engines/themePreferenceModel';
import {
  analyzeImportedAppData,
  canImportDataRepairReport,
  repairImportedAppData,
  type DataRepairReport,
  type DataRepairResult,
} from '../engines/dataRepairEngine';
import { buildCoachActionListViewModel } from '../presenters/coachActionPresenter';
import { buildDataHealthViewModel, type DataHealthActionView } from '../presenters/dataHealthPresenter';
import type { AppData, UnitSettings, WeightUnit } from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageHeader } from '../ui/PageHeader';
import { CoachActionList } from '../ui/CoachActionList';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { AboutDataSafetyPanel } from '../uiOs/settings/AboutDataSafetyPanel';
import { BackupRecoverySettingsPanel } from '../uiOs/settings/BackupRecoverySettingsPanel';
import { CloudCandidateSettingsPanel } from '../uiOs/settings/CloudCandidateSettingsPanel';
import { DiagnosticsDataSafetyPanel } from '../uiOs/settings/DiagnosticsDataSafetyPanel';
import { EmergencyLocalSettingsPanel } from '../uiOs/settings/EmergencyLocalSettingsPanel';
import { EquipmentProfileSettingsPanel } from '../uiOs/settings/EquipmentProfileSettingsPanel';
import { SettingsControlCenter } from '../uiOs/settings/SettingsControlCenter';
import { SettingsGroupCard } from '../uiOs/settings/SettingsGroupCard';
import { ThemeSettingsPanel } from '../uiOs/settings/ThemeSettingsPanel';
import { HealthDataPanel } from './HealthDataPanel';

interface ProfileViewProps {
  data: AppData;
  unitSettings: UnitSettings;
  coachAutomationSummary?: CoachAutomationSummary;
  coachActions?: CoachAction[];
  onUpdateUnitSettings: (updates: Partial<UnitSettings>) => void;
  onRestoreData: (data: AppData) => void;
  onUpdateHealthData: (data: AppData) => void;
  onOpenAssessment: () => void;
  onOpenRecordData: () => void;
  themePreference?: ThemePreferenceResult;
  onThemeChange?: (mode: ThemePreferenceMode) => void;
  onDataHealthAction?: (action: DataHealthActionView) => void;
  onCoachAction?: (action: CoachAction) => void;
  onDismissCoachAction?: (action: CoachAction) => void;
  targetSection?: ProfileTargetSection | null;
}

export type ProfileTargetSection = 'unit_settings' | 'health_data' | 'data_management' | 'screening';

type PendingRestore = {
  fileName: string;
  rawData: unknown;
  report: DataRepairReport;
  repairResult?: DataRepairResult;
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
  coachActions,
  onUpdateUnitSettings,
  onRestoreData,
  onUpdateHealthData,
  onOpenAssessment,
  onOpenRecordData,
  themePreference: controlledThemePreference,
  onThemeChange,
  onDataHealthAction,
  onCoachAction,
  onDismissCoachAction,
  targetSection,
}: ProfileViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const screeningRef = React.useRef<HTMLDivElement | null>(null);
  const unitSettingsRef = React.useRef<HTMLDivElement | null>(null);
  const healthDataRef = React.useRef<HTMLDivElement | null>(null);
  const dataManagementRef = React.useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = React.useState('');
  const [pendingRestore, setPendingRestore] = React.useState<PendingRestore | null>(null);
  const [fallbackThemeMode, setFallbackThemeMode] = React.useState<ThemePreferenceMode>('system');
  const analyticsHistory = filterAnalyticsHistory(data.history || []);
  const normalSessionCount = analyticsHistory.length;
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
  const allDataHealthIssues = React.useMemo(
    () => [...(dataHealthViewModel?.primaryIssues || []), ...(dataHealthViewModel?.secondaryIssues || [])],
    [dataHealthViewModel],
  );
  const visibleDataHealthIssues = React.useMemo(() => allDataHealthIssues.slice(0, 3), [allDataHealthIssues]);
  const hiddenDataHealthIssueCount = Math.max(0, allDataHealthIssues.length - visibleDataHealthIssues.length);
  const dataHealthClarity = React.useMemo(
    () =>
      buildDataHealthClaritySummary({
        issues: visibleDataHealthIssues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          userMessage: issue.userMessage,
          severityLabel: issue.severityLabel,
          technicalDetails: issue.technicalDetails,
        })),
        sourceOfTruthClear: true,
        backupStatus: 'unknown',
        cloudCandidateEnabled: false,
        ownerScopeClear: true,
        schemaValidationClear: true,
      }),
    [visibleDataHealthIssues],
  );
  const fallbackThemePreference = React.useMemo(
    () => resolveThemePreference({ selectedThemeMode: fallbackThemeMode, systemPrefersDark: false, focusModeImmersive: true }),
    [fallbackThemeMode],
  );
  const themePreference = controlledThemePreference || fallbackThemePreference;
  const themeMode = themePreference.selectedThemeMode;
  const handleThemeChange = onThemeChange || setFallbackThemeMode;
  const settingsSafetySummary = React.useMemo(
    () =>
      buildSettingsSafetySummary({
        backupStatus: normalSessionCount ? 'unknown' : 'missing',
        emergencyLocalAvailable: true,
        cloudCandidateEnabled: false,
        sourceOfTruthClear: true,
        dataHealthOverallState: dataHealthClarity.overallState,
        diagnosticsAvailable: Boolean(dataHealthViewModel),
        equipmentProfileCoverage: 'partial',
        acceptedMutationRouteCount: 7,
        hasBlockedRoutes: true,
        themeMode,
        unitsMode: unitSettings.weightUnit,
         personalOnlyMode: true,
         cloudSyncEnabled: false,
         automaticWorkerEnabled: false,
       }),
    [dataHealthClarity.overallState, dataHealthViewModel, normalSessionCount, themeMode, unitSettings.weightUnit],
  );
  const coachActionListViewModel = React.useMemo(
    () => buildCoachActionListViewModel(coachActions || [], { surface: 'profile' }),
    [coachActions],
  );

  const renderDataHealthIssueActions = React.useCallback(
    (issueId: string) => {
      const issue = allDataHealthIssues.find((item) => item.id === issueId);
      if (!issue || !onDataHealthAction) return null;

      return (
        <>
          {issue.action && issue.action.type !== 'none' ? (
            <ActionButton type="button" size="sm" variant="secondary" onClick={() => onDataHealthAction(issue.action!)}>
              {issue.action.label}
            </ActionButton>
          ) : null}
          {issue.dismissAction ? (
            <ActionButton type="button" size="sm" variant="ghost" onClick={() => onDataHealthAction(issue.dismissAction!)}>
              {issue.dismissAction.label}
            </ActionButton>
          ) : null}
          {issue.action?.description ? (
            <span className="text-xs leading-5 text-white/45">{issue.action.description}</span>
          ) : null}
        </>
      );
    },
    [allDataHealthIssues, onDataHealthAction],
  );

  React.useEffect(() => {
    const targets: Record<ProfileTargetSection, React.RefObject<HTMLDivElement | null>> = {
      screening: screeningRef,
      unit_settings: unitSettingsRef,
      health_data: healthDataRef,
      data_management: dataManagementRef,
    };
    if (!targetSection) return;
    targets[targetSection]?.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [targetSection]);

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
      const parsed = JSON.parse(await file.text()) as unknown;
      const report = analyzeImportedAppData(parsed);
      const repairResult = report.status === 'unsafe'
        ? undefined
        : repairImportedAppData(parsed, {
            repairDate: todayKey(),
            sourceFileName: file.name,
            maxRepairLogEntries: 200,
          });
      setPendingRestore({ fileName: file.name, rawData: parsed, report, repairResult });
      if (report.status === 'clean') setMessage('备份文件已通过检查，可以导入。');
      else if (report.status === 'repairable') setMessage('发现可修复问题，确认后将导入修复副本。');
      else if (report.status === 'needs_review') setMessage('部分历史记录需要人工检查，但清理后的数据可继续导入。');
      else setMessage('该 JSON 不是安全的 IronPath 应用备份，禁止导入。');
    } catch {
      setMessage('导入失败，请确认文件是 IronPath JSON 备份。');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadCleanedBackup = () => {
    if (!pendingRestore?.repairResult) return;
    downloadText(
      `ironpath-cleaned-${todayKey()}.json`,
      JSON.stringify(pendingRestore.repairResult.repairedData, null, 2),
      'application/json',
    );
    setMessage('已生成 cleaned JSON。原始文件未被覆盖。');
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    if (!canImportDataRepairReport(pendingRestore.report) || !pendingRestore.repairResult) {
      setMessage('该备份不安全，已阻止导入。');
      return;
    }
    try {
      onRestoreData(pendingRestore.repairResult.repairedData);
      setPendingRestore(null);
      setMessage(
        pendingRestore.report.status === 'needs_review'
          ? '已导入清理后的数据。部分历史记录仍需人工检查。'
          : pendingRestore.report.status === 'repairable'
            ? '已导入修复后的备份副本。'
            : '已导入备份。',
      );
    } catch {
      setMessage('导入失败，当前数据未被替换。');
    }
  };

  const restoreStatusLabel = (report: DataRepairReport) =>
    ({
      clean: '检查通过',
      repairable: '发现可修复问题',
      needs_review: '需要人工复核',
      unsafe: '禁止导入',
    })[report.status];

  const restoreConfirmText = (report: DataRepairReport) =>
    report.status === 'needs_review' ? '我已了解，导入修复副本' : report.status === 'repairable' ? '导入修复副本' : '导入';

  return (
    <ResponsivePageLayout>
      <PageHeader
        eyebrow="我的"
        title="设置中心"
      />

      <SettingsControlCenter summary={settingsSafetySummary}>
        <div ref={unitSettingsRef}>
          <ThemeSettingsPanel
            theme={themePreference}
            unitSettings={unitSettings}
            onThemeChange={handleThemeChange}
            onUnitChange={(unit: WeightUnit) => onUpdateUnitSettings({ weightUnit: unit })}
          />
        </div>

        <div ref={dataManagementRef}>
          <BackupRecoverySettingsPanel
            copy={settingsSafetySummary.backupRecoveryCopy}
            message={message}
            onDownloadBackup={downloadBackup}
            onDownloadCsv={downloadCsv}
            onImportClick={() => fileInputRef.current?.click()}
            onOpenRecordData={onOpenRecordData}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
        </div>

        <EmergencyLocalSettingsPanel copy={settingsSafetySummary.emergencyLocalCopy} />
        <EquipmentProfileSettingsPanel copy={settingsSafetySummary.equipmentProfileCopy} />
        <CloudCandidateSettingsPanel copy={settingsSafetySummary.cloudCandidateCopy} />

        <DiagnosticsDataSafetyPanel
          dataHealthLabel="数据健康检查"
          diagnosticsCopy={settingsSafetySummary.diagnosticsCopy}
          dataHealthSummary={dataHealthClarity}
          hiddenIssueCount={hiddenDataHealthIssueCount}
          showAllIssuesLabel="查看全部问题"
          issueDetailFallbackLabel="查看详情"
          renderIssueActions={renderDataHealthIssueActions}
        />

        <details className="xl:col-span-2 rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-white" data-settings-secondary-details="collapsed">
          <summary className="cursor-pointer text-sm font-semibold">更多设置与低频维护</summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div ref={healthDataRef} className="xl:col-span-2">
              <SettingsGroupCard className="xl:col-span-2">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-500">健康数据导入</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">健康数据导入</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    手动导入 CSV / JSON / 健康导出文件，用于恢复和活动负荷参考。此处不会上传完整训练数据。
                  </p>
                </div>
                <HealthDataPanel data={data} onUpdateData={onUpdateHealthData} />
              </SettingsGroupCard>
            </div>

            <div ref={screeningRef}>
              <SettingsGroupCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">资料与筛查</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">身体 / 动作筛查</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      管理训练目标、体态问题、动作限制和疼痛触发。低频配置集中在设置页，不挤占训练流程。
                    </p>
                  </div>
                  <ActionButton variant="primary" onClick={onOpenAssessment}>
                    <ShieldCheck className="h-4 w-4" />
                    打开筛查
                  </ActionButton>
                </div>
              </SettingsGroupCard>
            </div>

            <SettingsGroupCard className="xl:col-span-2">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-500">教练建议</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">教练动作收件箱</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  教练自动化只生成建议，不会自动覆盖计划或修改历史。采用建议、修正记录或调整计划仍由你手动确认。
                </p>
              </div>
              <CoachActionList
                title="教练动作收件箱"
                description="集中查看待处理、已采用、已忽略和已过期的教练建议；本轮按钮只做导航或查看，不会自动修改数据。"
                viewModel={coachActionListViewModel}
                showStatusFilters
                onAction={onCoachAction}
                onDismiss={onDismissCoachAction}
                onDetail={onCoachAction}
                emptyText="暂无需要处理的教练建议。"
              />
            </SettingsGroupCard>

            <AboutDataSafetyPanel historyCount={data.history?.length || 0} unitLabel={unitSettings.weightUnit} />
          </div>
        </details>
      </SettingsControlCenter>
      {pendingRestore ? (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          {pendingRestore.report.status === 'unsafe' ? (
            <section
              role="dialog"
              aria-modal="true"
              aria-label="导入备份被阻止"
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10"
            >
              <h2 className="text-lg font-semibold leading-7 text-slate-950">导入备份被阻止</h2>
              <div className="mt-2 space-y-3 text-sm leading-6 text-slate-600">
                <Notice tone="rose" title={restoreStatusLabel(pendingRestore.report)}>
                  该文件不是安全的 IronPath 应用备份，当前数据未被修改。
                </Notice>
                <div>文件：{pendingRestore.fileName}</div>
                {pendingRestore.report.issues.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                    <div className="font-semibold text-rose-950">{item.title}</div>
                    <div className="text-xs text-rose-800">{item.message}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <ActionButton variant="secondary" size="lg" className="w-full" onClick={() => setPendingRestore(null)}>
                  关闭
                </ActionButton>
              </div>
            </section>
          ) : (
            <ConfirmDialog
              title="导入备份？"
              description={
                <div className="space-y-3">
                  <p>导入会替换当前浏览器里的 IronPath 数据。导入前请先导出现有备份；原始 JSON 文件不会被覆盖。</p>
                  <Notice tone={pendingRestore.report.status === 'needs_review' ? 'amber' : pendingRestore.report.status === 'repairable' ? 'amber' : 'emerald'} title={restoreStatusLabel(pendingRestore.report)}>
                    {pendingRestore.report.status === 'needs_review'
                      ? '部分历史记录需要人工检查，但清理后的数据可继续导入。'
                      : pendingRestore.report.status === 'repairable'
                        ? '确认后会导入修复副本，不会写回原始文件。'
                        : '备份文件已通过检查，可以导入。'}
                  </Notice>
                  <div className="text-xs text-slate-500">文件：{pendingRestore.fileName}</div>
                  {pendingRestore.report.issues.length ? (
                    <div className="space-y-2">
                      {pendingRestore.report.issues.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2">
                          <div className="font-semibold text-slate-950">{item.title}</div>
                          <div className="text-xs leading-5 text-slate-600">{item.message}</div>
                        </div>
                      ))}
                      {pendingRestore.report.issues.length > 5 ? (
                        <div className="text-xs text-slate-500">还有 {pendingRestore.report.issues.length - 5} 条问题已写入修复预览。</div>
                      ) : null}
                    </div>
                  ) : null}
                  {pendingRestore.repairResult ? (
                    <ActionButton type="button" variant="secondary" size="sm" onClick={downloadCleanedBackup}>
                      <Download className="h-4 w-4" />
                      下载修复后的 JSON
                    </ActionButton>
                  ) : null}
                </div>
              }
              confirmText={restoreConfirmText(pendingRestore.report)}
              cancelText="取消"
              variant="warning"
              onCancel={() => setPendingRestore(null)}
              onConfirm={confirmRestore}
            />
          )}
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
