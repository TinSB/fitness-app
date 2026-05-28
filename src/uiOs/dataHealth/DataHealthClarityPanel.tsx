import type { ReactNode } from 'react';
import type { DataHealthClaritySummaryResult } from '../../engines/dataHealthClaritySummary';
import type { DataHealthAutoRepairSummary } from '../../dataHealth/appDataRepairTypes';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';
import { DataHealthAutoRepairStatus } from './DataHealthAutoRepairStatus';
import { DataHealthIssueClarityCard } from './DataHealthIssueClarityCard';
import { DataHealthSafetyNotice } from './DataHealthSafetyNotice';

type DataHealthClarityPanelProps = {
  summary: DataHealthClaritySummaryResult;
  renderIssueActions?: (issueId: string) => ReactNode;
  autoRepairSummary?: DataHealthAutoRepairSummary;
};

const stateLabel: Record<DataHealthClaritySummaryResult['overallState'], string> = {
  healthy: '健康',
  review_recommended: '建议检查',
  caution: '谨慎复查',
  stop: '先暂停',
  emergency: '紧急本地',
  data_insufficient: '数据不足',
};

const stateTone: Record<DataHealthClaritySummaryResult['overallState'], UiOsBadgeState> = {
  healthy: 'safe',
  review_recommended: 'info',
  caution: 'warning',
  stop: 'danger',
  emergency: 'manual-required',
  data_insufficient: 'disabled',
};

export function DataHealthClarityPanel({ summary, renderIssueActions, autoRepairSummary }: DataHealthClarityPanelProps) {
  return (
    <GlassCard as="section" padding="lg" className="mb-3 text-white" ariaLabel="Data Health clarity panel" highlight>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-white/55">数据健康复查</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{summary.summaryTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-white/64">{summary.summaryExplanation}</p>
          <div className="mt-2">
            <DataHealthAutoRepairStatus summary={autoRepairSummary} />
          </div>
        </div>
        <StatusBadge state={stateTone[summary.overallState]}>{stateLabel[summary.overallState]}</StatusBadge>
      </div>

      <div className="mt-4">
        <DataHealthSafetyNotice summary={summary} />
      </div>

      <div className="mt-4 space-y-3">
        {summary.issueCards.length ? (
          summary.issueCards.map((issue) => (
            <DataHealthIssueClarityCard key={issue.issueId} issue={issue} actions={renderIssueActions?.(issue.issueId)} />
          ))
        ) : (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            暂无待处理数据健康问题。没有发现明显异常。本地训练记录可以继续。
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-xs leading-5 text-white/45">
        不提供自动修复，不执行破坏性操作，不上传诊断数据。修复应用接口仍然不可用。
      </div>
    </GlassCard>
  );
}
