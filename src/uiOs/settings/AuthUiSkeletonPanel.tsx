import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

const rows = [
  ['登录', '不需要登录'],
  ['同步', '默认关闭'],
  ['数据', '仍保存在本机'],
  ['后续', '后续单独确认'],
];

export function AuthUiSkeletonPanel() {
  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" data-theme-text="mutedText">账号</p>
          <h3 className="mt-1 text-lg font-bold" data-theme-text="cardTitle">账号候选</h3>
          <p className="mt-1 text-sm leading-6" data-theme-text="secondaryText">
            账号入口先展示状态；不需要登录，不启动同步，不改变计划和记录。
          </p>
        </div>
        <StatusBadge state="manual-required">仅预览</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3"
            data-theme-surface="compact_row"
          >
            <div className="text-xs font-semibold uppercase tracking-wide" data-theme-text="mutedText">{label}</div>
            <div className="mt-1 text-sm font-semibold" data-theme-text="secondaryText">{value}</div>
          </div>
        ))}
      </div>
    </SettingsGroupCard>
  );
}
