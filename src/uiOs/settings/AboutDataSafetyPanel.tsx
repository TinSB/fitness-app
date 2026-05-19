import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type AboutDataSafetyPanelProps = {
  historyCount: number;
  unitLabel: string;
};

export function AboutDataSafetyPanel({ historyCount, unitLabel }: AboutDataSafetyPanelProps) {
  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/45">About / Data Safety</p>
          <h3 className="mt-1 text-lg font-bold text-white">关于与数据安全</h3>
          <p className="mt-1 text-sm leading-6 text-white/60">
            IronPath 仍是个人训练工具。本地数据是默认来源，云端候选不会自动覆盖。
          </p>
        </div>
        <StatusBadge state="safe" className="bg-emerald-100 text-emerald-700">personal-only</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" data-theme-surface="compact_row">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/35">单位</div>
          <div className="mt-1 text-sm font-bold text-white">{unitLabel}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" data-theme-surface="compact_row">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/35">历史</div>
          <div className="mt-1 text-sm font-bold text-white">{historyCount} 次训练</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" data-theme-surface="compact_row">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/35">边界</div>
          <div className="mt-1 text-sm font-bold text-white">写入边界已锁定</div>
        </div>
      </div>
    </SettingsGroupCard>
  );
}
