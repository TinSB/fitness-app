import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type CloudCandidateSettingsPanelProps = {
  copy: string;
};

const items = [
  ['状态', '手动候选'],
  ['读取候选', '查看'],
  ['上传候选', '需要手动确认'],
  ['冲突解决', '保持手动'],
];

export function CloudCandidateSettingsPanel(_props: CloudCandidateSettingsPanelProps) {
  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" data-theme-text="mutedText">云端候选</p>
          <h3 className="mt-1 text-lg font-bold" data-theme-text="cardTitle">云端候选</h3>
        </div>
        <StatusBadge state="manual-required">手动候选</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3" data-theme-surface="compact_row">
            <div className="text-xs font-semibold uppercase tracking-wide" data-theme-text="mutedText">{label}</div>
            <div className="mt-1 text-sm font-semibold" data-theme-text="secondaryText">{value}</div>
          </div>
        ))}
      </div>
    </SettingsGroupCard>
  );
}
