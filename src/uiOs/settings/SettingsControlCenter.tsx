import type { ReactNode } from 'react';
import type { SettingsSafetySummaryResult } from '../../engines/settingsSafetySummary';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';
import { SafetyStrip } from '../surfaces/SafetyStrip';

export type SettingsControlCenterProps = {
  summary: SettingsSafetySummaryResult;
  children: ReactNode;
};

const stateTone: Record<SettingsSafetySummaryResult['overallSafetyState'], UiOsBadgeState> = {
  safe: 'safe',
  review_recommended: 'info',
  caution: 'warning',
  stop: 'danger',
  emergency: 'manual-required',
  incomplete: 'disabled',
};

const stateLabel: Record<SettingsSafetySummaryResult['overallSafetyState'], string> = {
  safe: '本地优先正常',
  review_recommended: '建议复查',
  caution: '谨慎处理',
  stop: '先停止',
  emergency: '紧急本地',
  incomplete: '待补全',
};

export function SettingsControlCenter({ summary, children }: SettingsControlCenterProps) {
  return (
    <div className="space-y-4">
      <GlassCard as="section" padding="lg" className="text-white" ariaLabel="Settings safety summary" highlight>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-white/55">Owner-only control center</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{summary.summaryTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-white/64">{summary.summaryExplanation}</p>
          </div>
          <StatusBadge state={stateTone[summary.overallSafetyState]}>{stateLabel[summary.overallSafetyState]}</StatusBadge>
        </div>

        <div className="mt-4">
          <SafetyStrip state={summary.overallSafetyState === 'stop' || summary.overallSafetyState === 'emergency' ? 'source-unclear' : 'local-ok'} includeSecondaryCopy />
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {summary.safeNextActions.slice(0, 3).map((action) => (
            <div key={action} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70">
              {action}
            </div>
          ))}
        </div>

        {summary.highRiskWarnings.length ? (
          <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm leading-6 text-orange-100">
            {summary.highRiskWarnings.join(' ')}
          </div>
        ) : null}
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">{children}</div>
    </div>
  );
}
