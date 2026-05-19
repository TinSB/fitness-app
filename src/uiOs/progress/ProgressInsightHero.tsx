import type { ProgressClaritySummaryResult } from '../../engines/progressClaritySummary';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

type ProgressInsightHeroProps = {
  summary: ProgressClaritySummaryResult;
};

const badgeState: Record<ProgressClaritySummaryResult['insightState'], UiOsBadgeState> = {
  improving: 'safe',
  stable: 'info',
  fatigue_risk: 'warning',
  recovery_recommended: 'manual-required',
  data_insufficient: 'disabled',
  mixed: 'warning',
};

export function ProgressInsightHero({ summary }: ProgressInsightHeroProps) {
  return (
    <GlassCard as="section" padding="lg" highlight className="text-white" ariaLabel="Progress insight hero">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-white/55">训练状态解读</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">{summary.heroTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">{summary.heroExplanation}</p>
        </div>
        <StatusBadge state={badgeState[summary.insightState]}>{summary.readinessLabel}</StatusBadge>
      </div>
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.06] p-4">
        <p className="text-xs font-semibold text-white/45">下次建议</p>
        <p className="mt-1 text-lg font-semibold text-emerald-200">{summary.primaryRecommendation}</p>
        {summary.caution ? <p className="mt-2 text-sm leading-6 text-amber-200/80">{summary.caution}</p> : null}
      </div>
    </GlassCard>
  );
}
