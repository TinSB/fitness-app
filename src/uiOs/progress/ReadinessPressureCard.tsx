import type { ProgressUserFacing } from '../../engines/trainingDecisionTypes';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

type ReadinessPressureCardProps = {
  summary: ProgressUserFacing;
};

export function ReadinessPressureCard({ summary }: ReadinessPressureCardProps) {
  const pressureState = summary.recoveryPressureLabel.includes('偏高') ? 'warning' : summary.recoveryPressureLabel.includes('未知') ? 'disabled' : 'safe';

  return (
    <GlassCard as="section" padding="md" className="text-white" ariaLabel="Readiness and recovery pressure">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/55">Readiness</p>
            <StatusBadge state={summary.readinessLabel.includes('保守') || summary.readinessLabel.includes('恢复') ? 'warning' : summary.readinessLabel.includes('不足') ? 'disabled' : 'safe'}>
              {summary.readinessLabel}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/62">基于已有训练记录做保守解释，不依赖穿戴设备或医疗判断。</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/55">Recovery pressure</p>
            <StatusBadge state={pressureState}>{summary.recoveryPressureLabel}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/62">压力来自训练频率、有效组、训练量和不适标记的解释层。</p>
        </div>
      </div>
    </GlassCard>
  );
}
