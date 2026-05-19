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
  supportingAction?: ReactNode;
  className?: string;
};

export function TodayDecisionHero({ decision, dateLabel, primaryAction, secondaryActions, supportingAction, className = '' }: TodayDecisionHeroProps) {
  return (
    <GlassCard
      as="section"
      padding="none"
      className={classNames('overflow-hidden rounded-[28px]', className)}
      ariaLabel="今日训练决策"
      surface="training_hero"
      data-today-hero-density="mobile-compact"
      highlight
    >
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
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-4xl">{decision.heroTitle}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/62">{decision.heroExplanation}</p>
        </div>
        <div className="flex flex-col gap-2" data-today-primary-action-slot="hero">
          {primaryAction}
          {secondaryActions}
          {supportingAction ? <div data-today-supporting-action-slot="hero">{supportingAction}</div> : null}
        </div>
      </div>
    </GlassCard>
  );
}
