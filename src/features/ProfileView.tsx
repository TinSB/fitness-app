import React from 'react';
import { Activity, Database, Download, HardDrive, Ruler, ShieldCheck, Smartphone } from 'lucide-react';
import { downloadText, makeCsv } from '../engines/analytics';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { todayKey } from '../engines/engineUtils';
import type { AppData, UnitSettings } from '../models/training-model';
import { InlineNotice, SectionHeader } from '../ui/common';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { HealthDataPanel } from './HealthDataPanel';

interface ProfileViewProps {
  data: AppData;
  unitSettings: UnitSettings;
  onUpdateUnitSettings: (updates: Partial<UnitSettings>) => void;
  onRestoreData: (data: AppData) => void;
  onUpdateHealthData: (data: AppData) => void;
  onOpenAssessment: () => void;
  onOpenRecordData: () => void;
}

export function ProfileView({ data, unitSettings, onUpdateUnitSettings, onRestoreData, onUpdateHealthData, onOpenAssessment, onOpenRecordData }: ProfileViewProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = React.useState('');
  const analyticsHistory = filterAnalyticsHistory(data.history || []);

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
      onRestoreData(parsed);
      setMessage('已导入备份。');
    } catch {
      setMessage('导入失败，请确认文件是 IronPath JSON 备份。');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-5 pt-4 md:px-8 md:py-8">
      <PageHeader eyebrow="我的" title="设置与资料" description="筛查、单位、健康数据导入和备份恢复都放在这里。" />
      <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-3">
          <Card>
            <SectionHeader
              eyebrow="筛查"
              title="身体 / 动作筛查"
              description="管理身体资料、训练目标、体态筛查和动作受限情况。"
              action={<StatusBadge tone="emerald">低频设置</StatusBadge>}
            />
            <ActionButton variant="primary" onClick={onOpenAssessment} fullWidth>
              <ShieldCheck className="h-4 w-4" />
              打开筛查
            </ActionButton>
          </Card>

          <Card>
            <SectionHeader eyebrow="单位" title="重量单位" description="切换只影响显示和输入，历史数据仍按 kg 保存。" />
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
                  {unit}
                </button>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <Card>
            <SectionHeader
              eyebrow="数据"
              title="数据管理"
              description="本地备份、导入恢复、CSV 导出都在这里。记录页的数据分区也保留同样入口。"
              action={
                <ActionButton variant="ghost" size="sm" onClick={onOpenRecordData}>
                  去记录页数据
                </ActionButton>
              }
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <ActionButton variant="secondary" onClick={downloadBackup}>
                <Download className="h-4 w-4" />
                导出 JSON
              </ActionButton>
              <ActionButton variant="secondary" onClick={downloadCsv}>
                <Activity className="h-4 w-4" />
                导出 CSV
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Database className="h-4 w-4" />
                导入备份
              </ActionButton>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImportFile(event.target.files?.[0])} />
            {message ? (
              <div className="mt-3">
                <InlineNotice tone={message.includes('失败') ? 'rose' : 'emerald'}>{message}</InlineNotice>
              </div>
            ) : null}
          </Card>

          <HealthDataPanel data={data} onUpdateData={onUpdateHealthData} />

          <Card>
            <SectionHeader eyebrow="PWA" title="手机使用" description="iPhone Safari 打开线上地址后，可以添加到主屏幕作为本地训练工具使用。" />
            <div className="grid gap-2 sm:grid-cols-2">
              <InlineNotice tone="slate" title="本地数据">
                训练记录默认保存在当前浏览器。换设备或清理 Safari 数据前，先导出 JSON 备份。
              </InlineNotice>
              <InlineNotice tone="slate" title="非医疗工具">
                IronPath 用于训练记录和计划管理，不替代医疗诊断或康复治疗。
              </InlineNotice>
            </div>
          </Card>

          <Card>
            <SectionHeader eyebrow="关于" title="IronPath" description="给自己用的力量训练操作系统。" />
            <div className="grid gap-2 sm:grid-cols-3">
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
          </Card>
        </section>
      </div>
    </div>
  );
}
