import type { EquipmentProfile, ReadinessBias, RoundingPreference, SetPurpose } from '../engines/equipmentAwareLoadModel';
import { buildEquipmentAwareRecommendationDisplay } from '../engines/equipmentAwareRecommendationDisplay';
import { number } from '../engines/engineUtils';
import { convertKgToDisplayWeight } from '../engines/unitConversionEngine';
import type { UnitSettings } from '../models/training-model';
import { EquipmentAwareLoadDisplay } from './EquipmentAwareLoadDisplay';

export type EquipmentAwareRecommendationWeightProps = {
  exerciseName: string;
  plannedWeightKg: unknown;
  setPurpose: SetPurpose;
  unitSettings: UnitSettings;
  readinessBias?: ReadinessBias;
  roundingPreference?: RoundingPreference;
  equipmentProfile?: EquipmentProfile;
  compact?: boolean;
  showDetails?: boolean;
  onOpenEquipmentProfile?: () => void;
};

export const EquipmentAwareRecommendationWeight = ({
  exerciseName,
  plannedWeightKg,
  setPurpose,
  unitSettings,
  readinessBias,
  roundingPreference,
  equipmentProfile,
  compact = false,
  showDetails = false,
  onOpenEquipmentProfile,
}: EquipmentAwareRecommendationWeightProps) => {
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
    locale: 'bilingual',
  });

  return (
    <div
      className={compact ? 'mt-2 text-xs' : 'mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm'}
      data-equipment-aware-recommendation-weight="display-only"
      data-source-weight-unit={unitSettings.weightUnit}
    >
      <div className="mb-1 text-xs font-semibold text-emerald-800">器械可做重量</div>
      <EquipmentAwareLoadDisplay
        displayResult={displayResult}
        compact={compact}
        showDetails={showDetails}
        onOpenEquipmentProfile={onOpenEquipmentProfile}
      />
    </div>
  );
};
