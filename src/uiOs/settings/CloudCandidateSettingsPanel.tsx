import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type CloudCandidateSettingsPanelProps = {
  copy: string;
};

const items = [
  ['状态', 'manual candidate only'],
  ['Cloud pull', '不会自动覆盖本地数据'],
  ['Cloud push', '需要手动确认'],
  ['冲突解决', '保持手动'],
];

export function CloudCandidateSettingsPanel({ copy }: CloudCandidateSettingsPanelProps) {
  return (
    <SettingsGroupCard tone="dark" className="text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/55">Cloud Candidate</p>
          <h3 className="mt-1 text-lg font-bold text-white">云端候选</h3>
          <p className="mt-1 text-sm leading-6 text-white/55">{copy}</p>
        </div>
        <StatusBadge state="manual-required">手动候选</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/35">{label}</div>
            <div className="mt-1 text-sm font-semibold text-white/75">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/45">
        不提供 casual sync 按钮；没有默认云端来源，没有 background sync，没有自动上传。
      </p>
    </SettingsGroupCard>
  );
}
