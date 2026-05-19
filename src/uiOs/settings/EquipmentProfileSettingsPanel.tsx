import { createDefaultEquipmentProfileDraft, validateEquipmentProfileDraft } from '../../engines/equipmentProfileDraft';
import { EquipmentProfileEditor } from '../../ui/EquipmentProfileEditor';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type EquipmentProfileSettingsPanelProps = {
  copy: string;
};

const equipmentCards = [
  ['Olympic barbell', '45 lb', '总重量 + 每边杠铃片。'],
  ['Smith machine', '25 lb', '杆重计入总重量。'],
  ['Dumbbell', 'per-hand / 5 lb increment', '每只手记录，不自动改写历史。'],
  ['Selectorized machine', 'machine stack', '按机器选项或递增配置。'],
  ['Plate-loaded', 'base/sled warning', '底座或雪橇重量未知时需要提示。'],
  ['Unknown/custom', 'configure later', '需要 owner review。'],
];

export function EquipmentProfileSettingsPanel({ copy }: EquipmentProfileSettingsPanelProps) {
  const draft = createDefaultEquipmentProfileDraft('plate_loaded_machine');
  const validation = validateEquipmentProfileDraft({ ...draft, includeBaseWeight: true });

  return (
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">Equipment Profiles</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">器械档案</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
        </div>
        <StatusBadge state="info" className="bg-blue-100 text-blue-700">draft-only</StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {equipmentCards.map(([title, value, detail]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-stone-50 px-4 py-3">
            <div className="text-sm font-bold text-slate-950">{title}</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700">{value}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
          </div>
        ))}
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-950">查看器械档案草稿编辑器</summary>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-stone-50 p-3">
          <EquipmentProfileEditor draft={draft} validation={validation} />
        </div>
      </details>
    </SettingsGroupCard>
  );
}
