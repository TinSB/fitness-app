import { ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type EmergencyLocalSettingsPanelProps = {
  copy: string;
};

export function EmergencyLocalSettingsPanel(_props: EmergencyLocalSettingsPanelProps) {
  return (
    <SettingsGroupCard>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-200">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">紧急本地模式</h3>
            <StatusBadge state="safe" className="bg-emerald-100 text-emerald-700">可用</StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold text-emerald-100">恢复本地模式</p>
        </div>
      </div>
    </SettingsGroupCard>
  );
}
