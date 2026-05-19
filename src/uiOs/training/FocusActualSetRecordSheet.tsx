import type { WeightUnit } from '../../models/training-model';
import { ActionButton } from '../primitives/ActionButton';
import { BottomSheet } from '../surfaces/BottomSheet';

export type FocusActualSetRecordSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  weightUnit: WeightUnit;
  weightValue?: number;
  repsValue?: number;
  rirValue?: number;
  noteValue?: string;
  missingInput?: boolean;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  onRirChange: (value: number) => void;
  onNoteChange?: (value: string) => void;
  onComplete: () => void;
};

const inputClassName = 'mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-base font-semibold text-white outline-none placeholder:text-white/25 focus:border-emerald-400';

export function FocusActualSetRecordSheet({
  isOpen,
  onClose,
  weightUnit,
  weightValue,
  repsValue,
  rirValue,
  noteValue,
  missingInput = false,
  onWeightChange,
  onRepsChange,
  onRirChange,
  onNoteChange,
  onComplete,
}: FocusActualSetRecordSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="记录本组">
      <div className="space-y-4" data-focus-actual-set-record-sheet="bottom-sheet">
        {missingInput ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">请填写重量和次数后完成本组。</div>
        ) : null}
        <label className="block text-sm font-semibold text-white/70">
          重量（{weightUnit}）
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step={weightUnit === 'lb' ? '1' : '0.5'}
            value={weightValue ?? ''}
            onChange={(event) => onWeightChange(Number(event.target.value))}
            className={inputClassName}
            placeholder={`0${weightUnit}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-white/70">
            次数
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={repsValue ?? ''}
              onChange={(event) => onRepsChange(Number(event.target.value))}
              className={inputClassName}
              placeholder="0 次"
            />
          </label>
          <label className="block text-sm font-semibold text-white/70">
            RIR
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="10"
              step="1"
              value={rirValue ?? ''}
              onChange={(event) => onRirChange(Number(event.target.value))}
              className={inputClassName}
              placeholder="可选"
            />
          </label>
        </div>
        {onNoteChange ? (
          <label className="block text-sm font-semibold text-white/70">
            备注
            <textarea
              value={noteValue ?? ''}
              onChange={(event) => onNoteChange(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-base font-semibold text-white outline-none placeholder:text-white/25 focus:border-emerald-400"
              placeholder="可选"
            />
          </label>
        ) : null}
        <ActionButton type="button" size="lg" fullWidth onClick={onComplete}>
          完成一组
        </ActionButton>
      </div>
    </BottomSheet>
  );
}
