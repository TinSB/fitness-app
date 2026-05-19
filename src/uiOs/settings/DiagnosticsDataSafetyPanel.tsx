import type { ReactNode } from 'react';
import type { DataHealthClaritySummaryResult } from '../../engines/dataHealthClaritySummary';
import { DataHealthClarityPanel } from '../dataHealth/DataHealthClarityPanel';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type DiagnosticsDataSafetyPanelProps = {
  diagnosticsCopy: string;
  dataHealthSummary: DataHealthClaritySummaryResult;
  dataHealthLabel?: string;
  hiddenIssueCount?: number;
  showAllIssuesLabel?: string;
  issueDetailFallbackLabel?: string;
  renderIssueActions?: (issueId: string) => ReactNode;
};

export function DiagnosticsDataSafetyPanel({
  diagnosticsCopy,
  dataHealthSummary,
  dataHealthLabel = '数据健康检查',
  hiddenIssueCount = 0,
  showAllIssuesLabel = '查看全部问题',
  issueDetailFallbackLabel = '查看详情',
  renderIssueActions,
}: DiagnosticsDataSafetyPanelProps) {
  return (
    <SettingsGroupCard className="xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/45">Diagnostics / Data Health</p>
          <h3 className="mt-1 text-lg font-bold text-white">诊断与数据安全</h3>
          <p className="mt-1 text-sm font-semibold text-white/72">{dataHealthLabel}</p>
          <p className="mt-1 text-sm leading-6 text-white/60">{diagnosticsCopy}</p>
        </div>
        <StatusBadge state="safe" className="bg-emerald-100 text-emerald-700">redacted</StatusBadge>
      </div>
      <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" data-settings-diagnostics-details="collapsed" data-theme-surface="compact_row">
        <summary className="cursor-pointer text-sm font-semibold text-white">查看数据健康详情</summary>
        <div className="mt-4">
          <DataHealthClarityPanel summary={dataHealthSummary} renderIssueActions={renderIssueActions} />
        </div>
      </details>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/42">
        <span>{issueDetailFallbackLabel}</span>
        {hiddenIssueCount > 0 ? (
          <span>
            {showAllIssuesLabel}：还有 {hiddenIssueCount} 条问题在完整数据健康视图中查看。
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/42">
        诊断摘要不会上传完整训练数据；不提供自动修复，也不会外传诊断。
      </p>
    </SettingsGroupCard>
  );
}
