import type { EquipmentAwareRecommendationDisplayResult } from '../engines/equipmentAwareRecommendationDisplay';

export type EquipmentAwareLoadDisplayProps = {
  displayResult: EquipmentAwareRecommendationDisplayResult;
  compact?: boolean;
  showDetails?: boolean;
  onOpenEquipmentProfile?: () => void;
};

export const EquipmentAwareLoadDisplay = ({
  displayResult,
  compact = false,
  showDetails = false,
  onOpenEquipmentProfile,
}: EquipmentAwareLoadDisplayProps) => (
  <section
    aria-label="Equipment-aware recommendation display"
    data-equipment-aware-load-display="presentational"
    data-compact={compact ? 'true' : 'false'}
  >
    <strong>{displayResult.primaryLabel}</strong>
    <p>{displayResult.secondaryLabel}</p>

    {displayResult.plateBreakdownLabel ? <p>{displayResult.plateBreakdownLabel}</p> : null}
    {displayResult.warningLabel ? <p role="alert">{displayResult.warningLabel}</p> : null}

    {showDetails ? (
      <div aria-label="Equipment-aware recommendation details">
        <p>{displayResult.detailLabel}</p>
        <p>{displayResult.reasonLabel}</p>
      </div>
    ) : null}

    {onOpenEquipmentProfile ? (
      <button type="button" onClick={onOpenEquipmentProfile}>
        配置器械档案
      </button>
    ) : null}
  </section>
);
