import type { ProgressClaritySummaryResult } from '../../engines/progressClaritySummary';
import { GlassCard } from '../primitives/GlassCard';

type EffectiveSetsVolumeCardProps = {
  summary: ProgressClaritySummaryResult;
};

export function EffectiveSetsVolumeCard({ summary }: EffectiveSetsVolumeCardProps) {
  return (
    <GlassCard as="section" padding="md" className="text-white" ariaLabel="Effective sets and volume explanation">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
          <p className="text-sm font-semibold text-white/55">有效组解释</p>
          <p className="mt-2 text-sm leading-6 text-white/62">{summary.effectiveSetExplanation}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
          <p className="text-sm font-semibold text-white/55">训练量 / 恢复含义</p>
          <p className="mt-2 text-sm leading-6 text-white/62">{summary.volumeExplanation}</p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/50">
        {summary.dataCoverageHint}
      </div>
    </GlassCard>
  );
}
