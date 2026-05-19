import { classNames } from '../../engines/engineUtils';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

export type TodaySevereRiskNoticeProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function TodaySevereRiskNotice({ title, message, actionLabel = '查看严重问题', onAction, className = '' }: TodaySevereRiskNoticeProps) {
  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl border-red-400/30 bg-red-500/10', className)} ariaLabel="严重风险提醒">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{title}</div>
            <StatusBadge state="danger">严重</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-red-50/80">{message}</p>
          <p className="mt-1 text-xs leading-5 text-red-50/55">只显示严重阻断项；完整 Data Health 留在设置或二级页面。</p>
        </div>
        {onAction ? (
          <ActionButton type="button" variant="danger" size="sm" onClick={onAction}>
            {actionLabel}
          </ActionButton>
        ) : null}
      </div>
    </GlassCard>
  );
}
