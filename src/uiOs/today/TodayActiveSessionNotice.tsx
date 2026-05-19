import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

export type TodayActiveSessionNoticeProps = {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
};

export function TodayActiveSessionNotice({ title = '有未完成训练', message, action, className = '' }: TodayActiveSessionNoticeProps) {
  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl border-amber-300/25 bg-amber-300/10', className)} ariaLabel="未完成训练提醒">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{title}</div>
            <StatusBadge state="warning">继续优先</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-amber-50/80">{message}</p>
        </div>
        {action ? <div className="min-w-[160px]">{action}</div> : null}
      </div>
    </GlassCard>
  );
}
