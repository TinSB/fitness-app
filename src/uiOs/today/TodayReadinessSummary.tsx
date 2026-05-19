import { classNames } from '../../engines/engineUtils';
import type { TodayDecisionSurfaceResult } from '../../engines/todayDecisionSurface';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

export type TodayReadinessSummaryProps = {
  decision: TodayDecisionSurfaceResult;
  readinessScore?: number;
  durationMinutes?: number;
  note?: string;
  className?: string;
};

const readinessState: Record<TodayDecisionSurfaceResult['decisionState'], UiOsBadgeState> = {
  train_recommended: 'safe',
  train_conservative: 'warning',
  recovery_recommended: 'info',
  continue_unfinished: 'warning',
  blocked_by_severe_risk: 'danger',
  source_unclear: 'manual-required',
  no_plan_available: 'disabled',
};

export function TodayReadinessSummary({ decision, readinessScore, durationMinutes, note, className = '' }: TodayReadinessSummaryProps) {
  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl', className)} ariaLabel="恢复疲劳摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">恢复 / 疲劳</div>
        </div>
        <StatusBadge state={readinessState[decision.decisionState]}>{decision.readinessLabel}</StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3">
          <div className="text-xs text-white/45">准备度</div>
          <div className="mt-1 text-2xl font-bold text-white">{typeof readinessScore === 'number' ? readinessScore : '--'}</div>
          <div className="text-xs text-white/35">满分 100</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3">
          <div className="text-xs text-white/45">预计时长</div>
          <div className="mt-1 text-2xl font-bold text-white">{typeof durationMinutes === 'number' ? durationMinutes : '--'}</div>
          <div className="text-xs text-white/35">分钟</div>
        </div>
      </div>
      {note ? <p className="mt-3 text-sm leading-6 text-white/58">{note}</p> : null}
    </GlassCard>
  );
}
