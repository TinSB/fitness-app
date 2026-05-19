import type { ReactNode } from 'react';
import type { DataHealthClarityIssueCard } from '../../engines/dataHealthClaritySummary';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

type DataHealthIssueClarityCardProps = {
  issue: DataHealthClarityIssueCard;
  actions?: ReactNode;
};

const severityLabel: Record<DataHealthClarityIssueCard['severity'], string> = {
  info: '提示',
  review: '建议检查',
  caution: '谨慎复查',
  stop: '先暂停',
  emergency: '紧急本地',
};

const severityState: Record<DataHealthClarityIssueCard['severity'], UiOsBadgeState> = {
  info: 'info',
  review: 'info',
  caution: 'warning',
  stop: 'danger',
  emergency: 'manual-required',
};

export function DataHealthIssueClarityCard({ issue, actions }: DataHealthIssueClarityCardProps) {
  return (
    <GlassCard as="article" padding="md" className="text-white" ariaLabel="Data Health issue clarity card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{issue.title}</p>
          <p className="mt-2 text-sm leading-6 text-white/62">{issue.explanation}</p>
        </div>
        <StatusBadge state={severityState[issue.severity]}>{severityLabel[issue.severity]}</StatusBadge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-3">
          <p className="text-xs font-semibold text-white/45">为什么重要</p>
          <p className="mt-1 text-xs leading-5 text-white/58">{issue.whyItMatters}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-3">
          <p className="text-xs font-semibold text-white/45">本地训练</p>
          <p className="mt-1 text-xs leading-5 text-white/58">{issue.localTrainingCopy}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-3">
          <p className="text-xs font-semibold text-white/45">云端候选 / 修复</p>
          <p className="mt-1 text-xs leading-5 text-white/58">{issue.cloudCandidateCopy} {issue.repairCopy}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/60">
          安全下一步：{issue.safeNextActionLabel}
        </span>
        {actions}
      </div>
    </GlassCard>
  );
}
