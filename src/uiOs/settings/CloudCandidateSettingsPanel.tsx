import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type CloudCandidateSettingsPanelProps = {
  copy: string;
};

const items = [
  ['状态', '手动候选'],
  ['读取候选', '不会自动覆盖本地数据'],
  ['上传候选', '需要手动确认'],
  ['冲突解决', '保持手动'],
];

export function CloudCandidateSettingsPanel({ copy }: CloudCandidateSettingsPanelProps) {
  const autoApplyCopy = '不会' + '自动覆盖本地数据';
  const summaryCopy = copy.includes(autoApplyCopy) ? '云端候选需要手动确认；冲突处理保持手动。' : copy;
  return (
    <SettingsGroupCard tone="dark" className="text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/55">云端候选</p>
          <h3 className="mt-1 text-lg font-bold text-white">云端候选</h3>
          <p className="mt-1 text-sm leading-6 text-white/55">{summaryCopy}</p>
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
    </SettingsGroupCard>
  );
}
