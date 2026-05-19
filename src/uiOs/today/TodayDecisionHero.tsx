import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import type { TodayDecisionSurfaceResult } from '../../engines/todayDecisionSurface';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

const stateTone: Record<TodayDecisionSurfaceResult['decisionState'], UiOsBadgeState> = {
  train_recommended: 'safe',
  train_conservative: 'warning',
  recovery_recommended: 'info',
  continue_unfinished: 'warning',
  blocked_by_severe_risk: 'danger',
  source_unclear: 'manual-required',
  no_plan_available: 'disabled',
};

export type TodayDecisionHeroProps = {
  decision: TodayDecisionSurfaceResult;
  dateLabel?: string;
  primaryAction: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
};

export function TodayDecisionHero({ decision, dateLabel, primaryAction, secondaryActions, className = '' }: TodayDecisionHeroProps) {
  return (
    <GlassCard as="section" padding="none" className={classNames('overflow-hidden rounded-[28px]', className)} ariaLabel="今日训练决策" highlight>
      <div className="border-b border-white/10 bg-white/[0.06] px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={stateTone[decision.decisionState]}>{decision.heroLabel}</StatusBadge>
          <StatusBadge state="info">{decision.readinessLabel}</StatusBadge>
          {dateLabel ? <span className="text-xs font-medium text-white/45">{dateLabel}</span> : null}
        </div>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_240px] md:p-5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-emerald-200">今天练什么</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">{decision.heroTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">{decision.heroExplanation}</p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 text-white/70">
              训练目标：<span className="font-semibold text-white">{decision.focusLabel}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 text-white/70">
              数据状态：<span className="font-semibold text-white">{decision.safetyLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {primaryAction}
          {secondaryActions}
        </div>
      </div>
    </GlassCard>
  );
}
