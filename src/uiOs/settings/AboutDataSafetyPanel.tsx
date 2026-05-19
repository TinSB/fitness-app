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
          <p className="text-sm font-semibold text-slate-500">About / Data Safety</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">关于与数据安全</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            IronPath remains personal-only；SaaS deferred。localStorage remains default/fallback/migration/emergency。
          </p>
        </div>
        <StatusBadge state="safe" className="bg-emerald-100 text-emerald-700">personal-only</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-stone-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">单位</div>
          <div className="mt-1 text-sm font-bold text-slate-950">{unitLabel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-stone-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">历史</div>
          <div className="mt-1 text-sm font-bold text-slate-950">{historyCount} 次训练</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-stone-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">边界</div>
          <div className="mt-1 text-sm font-bold text-slate-950">7 accepted write routes</div>
        </div>
      </div>
    </SettingsGroupCard>
  );
}
