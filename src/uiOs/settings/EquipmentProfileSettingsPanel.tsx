import { createDefaultEquipmentProfileDraft, validateEquipmentProfileDraft } from '../../engines/equipmentProfileDraft';
import { EquipmentProfileEditor } from '../../ui/EquipmentProfileEditor';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type EquipmentProfileSettingsPanelProps = {
  copy: string;
};

const equipmentCards = [
  ['Olympic barbell', '45 lb', '总重量 + 每边杠铃片'],
  ['Smith machine', '25 lb', '杆重计入总重量'],
  ['Dumbbell', '每只手 / 5 lb 一跳', '不自动改写历史记录'],
  ['Selectorized machine', '按机器插片', '按机器选项记录'],
  ['Plate-loaded', '注意器械自重', '底座或雪橇重量需要确认'],
  ['Unknown/custom', '稍后配置', '需要复查'],
];

export function EquipmentProfileSettingsPanel({ copy }: EquipmentProfileSettingsPanelProps) {
  const draft = createDefaultEquipmentProfileDraft('plate_loaded_machine');
  const validation = validateEquipmentProfileDraft({ ...draft, includeBaseWeight: true });

  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/45">Equipment Profiles</p>
          <h3 className="mt-1 text-lg font-bold text-white">器械档案</h3>
          <p className="mt-1 text-sm leading-6 text-white/60">{copy}</p>
        </div>
        <StatusBadge state="info" className="bg-blue-100 text-blue-700">草稿</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2" data-settings-equipment-compact-rows="true">
        {equipmentCards.map(([title, value, detail]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" data-theme-surface="compact_row">
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700">{value}</div>
            <div className="mt-1 text-xs leading-5 text-white/45">{detail}</div>
          </div>
        ))}
      </div>

      <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white/60" data-settings-equipment-editor="collapsed" data-theme-surface="compact_row">
        <summary className="cursor-pointer font-semibold text-white">查看器械档案草稿编辑器</summary>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <EquipmentProfileEditor draft={draft} validation={validation} />
        </div>
      </details>
    </SettingsGroupCard>
  );
}
