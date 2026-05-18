import type { EquipmentKind, LoadDisplayMode, RoundingPreference } from '../engines/equipmentAwareLoadModel';
import {
  type EquipmentProfileDraft,
  type EquipmentProfileDraftValidationResult,
  validateEquipmentProfileDraft,
} from '../engines/equipmentProfileDraft';

export type EquipmentProfileEditorProps = {
  draft: EquipmentProfileDraft;
  validation?: EquipmentProfileDraftValidationResult;
  visible?: boolean;
  onDraftChange?: (draft: EquipmentProfileDraft) => void;
  onRequestApply?: (draft: EquipmentProfileDraft) => void;
};

const equipmentKindLabels: Record<EquipmentKind, string> = {
  barbell: '杠铃 / Barbell',
  smith_machine: 'Smith 机 / Smith machine',
  dumbbell: '哑铃 / Dumbbell',
  selectorized_machine: '插片器械 / Selectorized',
  plate_loaded_machine: '挂片器械 / Plate-loaded',
  cable_stack: '绳索重量栈 / Cable stack',
  bodyweight: '自重 / Bodyweight',
  assisted_bodyweight: '辅助自重 / Assisted bodyweight',
  unknown: '未知/自定义 / Unknown',
};

const displayModeLabels: Record<LoadDisplayMode, string> = {
  total_weight: '总重量',
  per_hand: '每只手',
  per_side_plates: '每边杠铃片',
  machine_stack: '插片/重量栈',
  added_load: '已加重量',
  bodyweight_adjusted: '自重调整',
  total_plus_per_side: '总重量 + 每边杠铃片',
};

const roundingPreferenceLabels: Record<RoundingPreference, string> = {
  conservative: '保守',
  nearest: '最近可做重量',
  progressive: '积极',
  readiness_based: '按准备度',
};

const listValue = (values?: readonly number[]) => (values?.length ? values.join(', ') : '');

export const EquipmentProfileEditor = ({
  draft,
  validation,
  visible = true,
  onDraftChange,
  onRequestApply,
}: EquipmentProfileEditorProps) => {
  if (!visible) return null;

  const result = validation ?? validateEquipmentProfileDraft(draft);
  const update = (patch: Partial<EquipmentProfileDraft>) => onDraftChange?.({ ...draft, ...patch });

  return (
    <section aria-label="Equipment profile editor" data-equipment-profile-editor="presentational">
      <h2>器械档案草稿</h2>
      <p>这里只编辑草稿；不会自动影响历史记录，也不会自动同步到云端。</p>

      <div>
        <label>
          器械类型
          <select value={draft.equipmentKind} onChange={(event) => update({ equipmentKind: event.target.value as EquipmentKind })}>
            {Object.entries(equipmentKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          显示方式
          <select value={draft.displayMode} onChange={(event) => update({ displayMode: event.target.value as LoadDisplayMode })}>
            {Object.entries(displayModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          杠铃/杆重 lb
          <input type="number" value={draft.defaultBarWeightLb ?? ''} onChange={(event) => update({ defaultBarWeightLb: Number(event.target.value) })} />
        </label>
        <p>Olympic bar 默认 45 lb；Smith machine 默认 25 lb。</p>
      </div>

      <div>
        <label>
          每边可用杠铃片 lb
          <input value={listValue(draft.availablePlatesLb)} onChange={(event) => update({ availablePlatesLb: event.target.value.split(',').map(Number) })} />
        </label>
        <p>默认可用杠铃片：2.5 / 5 / 10 / 25 / 45 lb。</p>
      </div>

      <div>
        <label>
          哑铃递增 lb
          <input type="number" value={draft.dumbbellIncrementLb ?? ''} onChange={(event) => update({ dumbbellIncrementLb: Number(event.target.value) })} />
        </label>
        <p>哑铃按每只手记录；默认 5 lb 递增。</p>
      </div>

      <div>
        <label>
          插片/重量栈选项 lb
          <input value={listValue(draft.machineWeightOptionsLb)} onChange={(event) => update({ machineWeightOptionsLb: event.target.value.split(',').map(Number) })} />
        </label>
        <label>
          器械递增 lb
          <input type="number" value={draft.machineIncrementLb ?? ''} onChange={(event) => update({ machineIncrementLb: Number(event.target.value) })} />
        </label>
        <p>固定器械和绳索重量栈使用机器自己的选项或递增，不假设全局递增。</p>
      </div>

      <div>
        <label>
          器械自重/底座重量 lb
          <input type="number" value={draft.baseMachineWeightLb ?? ''} onChange={(event) => update({ baseMachineWeightLb: Number(event.target.value) })} />
        </label>
        <label>
          <input type="checkbox" checked={draft.includeBaseWeight} onChange={(event) => update({ includeBaseWeight: event.target.checked })} />
          推荐显示中计入器械自重/底座重量
        </label>
        <p>挂片器械的自重/雪橇重量只有已知并配置后才计入。</p>
      </div>

      <div>
        <label>
          取整偏好
          <select value={draft.roundingPreference} onChange={(event) => update({ roundingPreference: event.target.value as RoundingPreference })}>
            {Object.entries(roundingPreferenceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          备注
          <textarea value={draft.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
        </label>
      </div>

      {result.warnings.length ? (
        <div role="status">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {result.errors.length ? (
        <div role="alert">
          {result.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <button type="button" disabled={!result.isValid} onClick={() => onRequestApply?.(result.normalizedDraft)}>
        预览草稿
      </button>
      <button type="button" disabled>
        持久保存需后续任务授权
      </button>
    </section>
  );
};
