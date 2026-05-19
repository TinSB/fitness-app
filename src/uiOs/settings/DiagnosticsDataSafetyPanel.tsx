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
          <p className="text-sm font-semibold text-slate-500">Diagnostics / Data Health</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">诊断与数据安全</h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">{dataHealthLabel}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{diagnosticsCopy}</p>
        </div>
        <StatusBadge state="safe" className="bg-emerald-100 text-emerald-700">redacted</StatusBadge>
      </div>
      <div className="mt-4">
        <DataHealthClarityPanel summary={dataHealthSummary} renderIssueActions={renderIssueActions} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{issueDetailFallbackLabel}</span>
        {hiddenIssueCount > 0 ? (
          <span>
            {showAllIssuesLabel}：还有 {hiddenIssueCount} 条问题在完整数据健康视图中查看。
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Full Data Health details live in Settings, not in training flow. 不提供自动修复，不上传完整 AppData，不包含 secrets / tokens / service role。
      </p>
    </SettingsGroupCard>
  );
}
