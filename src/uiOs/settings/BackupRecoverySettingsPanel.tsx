import { Activity, Database, Download, Upload } from 'lucide-react';
import { ActionButton } from '../primitives/ActionButton';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type BackupRecoverySettingsPanelProps = {
  copy: string;
  message?: string;
  onDownloadBackup: () => void;
  onDownloadCsv: () => void;
  onImportClick: () => void;
  onOpenRecordData: () => void;
};

export function BackupRecoverySettingsPanel({
  copy,
  message,
  onDownloadBackup,
  onDownloadCsv,
  onImportClick,
  onOpenRecordData,
}: BackupRecoverySettingsPanelProps) {
  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">Backup / Recovery</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">备份与恢复</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
        </div>
        <StatusBadge state="warning" className="bg-amber-100 text-amber-700">需要确认</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ActionButton variant="secondary" className="bg-slate-900 text-white" onClick={onDownloadBackup}>
          <Download className="h-4 w-4" />
          导出 JSON
        </ActionButton>
        <ActionButton variant="secondary" className="bg-slate-900 text-white" onClick={onDownloadCsv}>
          <Activity className="h-4 w-4" />
          导出 CSV
        </ActionButton>
        <ActionButton variant="danger" className="bg-red-50 text-red-700" onClick={onImportClick}>
          <Upload className="h-4 w-4" />
          导入恢复
        </ActionButton>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        恢复会覆盖当前本地数据。导入 JSON 备份前建议先导出现有备份；确认后才替换当前浏览器里的 IronPath 数据。
      </div>
      {message ? (
        <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${message.includes('失败') ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {message}
        </div>
      ) : null}
      <div className="mt-3">
        <ActionButton variant="ghost" size="sm" className="text-slate-700" onClick={onOpenRecordData}>
          <Database className="h-4 w-4" />
          管理单次训练记录
        </ActionButton>
      </div>
    </SettingsGroupCard>
  );
}
