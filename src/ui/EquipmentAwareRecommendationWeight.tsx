import type { EquipmentProfile, ReadinessBias, RoundingPreference, SetPurpose } from '../engines/equipmentAwareLoadModel';
import { buildEquipmentAwareRecommendationDisplay } from '../engines/equipmentAwareRecommendationDisplay';
import { classNames, number } from '../engines/engineUtils';
import { convertKgToDisplayWeight } from '../engines/unitConversionEngine';
import type { UnitSettings } from '../models/training-model';
import { EquipmentAwareLoadDisplay } from './EquipmentAwareLoadDisplay';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type EquipmentAwareRecommendationWeightProps = {
  exerciseName: string;
  plannedWeightKg: unknown;
  setPurpose: SetPurpose;
  unitSettings: UnitSettings;
  readinessBias?: ReadinessBias;
  roundingPreference?: RoundingPreference;
  equipmentProfile?: EquipmentProfile;
  reps?: number | string;
  compact?: boolean;
  showDetails?: boolean;
  onOpenEquipmentProfile?: () => void;
  label?: string;
};

export const EquipmentAwareRecommendationWeight = ({
  exerciseName,
  plannedWeightKg,
  setPurpose,
  unitSettings,
  readinessBias,
  roundingPreference,
  equipmentProfile,
  reps,
  compact = false,
  showDetails = false,
  onOpenEquipmentProfile,
  label,
}: EquipmentAwareRecommendationWeightProps) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const safeWeightKg = number(plannedWeightKg);
  if (safeWeightKg <= 0) return null;

  const theoreticalWeightLb = convertKgToDisplayWeight(safeWeightKg, 'lb');
  const displayResult = buildEquipmentAwareRecommendationDisplay({
    exerciseName,
    theoreticalWeightLb,
    setPurpose,
    readinessBias,
    roundingPreference,
    equipmentProfile,
    showTheoreticalDetail: showDetails,
    locale: 'zh',
  });

  return (
    <div
      className={
        compact
          ? 'mt-2 text-xs'
          : classNames('mt-3 rounded-lg border p-3 text-sm', isDark ? 'border-white/10 bg-white/[0.05]' : 'border-slate-200 bg-slate-50')
      }
      data-equipment-aware-recommendation-weight="display-only"
      data-source-weight-unit={unitSettings.weightUnit}
      data-theme-surface="compact_row"
    >
      <EquipmentAwareLoadDisplay
        displayResult={displayResult}
        reps={reps}
        compact={compact}
        showDetails={showDetails}
        onOpenEquipmentProfile={onOpenEquipmentProfile}
        primaryLabel={label}
      />
    </div>
  );
};
