import type { EquipmentAwareRecommendationDisplayResult } from '../engines/equipmentAwareRecommendationDisplay';
import { EquipmentAwareLoadCard, type EquipmentLoadType } from '../uiOs/training/EquipmentAwareLoadCard';

export type EquipmentAwareLoadDisplayProps = {
  displayResult: EquipmentAwareRecommendationDisplayResult;
  compact?: boolean;
  showDetails?: boolean;
  onOpenEquipmentProfile?: () => void;
};

const mapEquipmentKind = (kind: EquipmentAwareRecommendationDisplayResult['equipmentKind']): EquipmentLoadType => {
  if (kind === 'dumbbell') return 'dumbbell';
  if (kind === 'selectorized_machine' || kind === 'cable_stack') return 'machine-stack';
  if (kind === 'plate_loaded_machine') return 'plate-loaded';
  if (kind === 'smith_machine') return 'smith';
  if (kind === 'unknown') return 'unknown';
  return 'barbell';
};

const mapState = (displayResult: EquipmentAwareRecommendationDisplayResult) => {
  if (displayResult.warningLabel) return 'warning' as const;
  if (!displayResult.isFeasible) return 'blocked' as const;
  return 'default' as const;
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
    <EquipmentAwareLoadCard
      type={mapEquipmentKind(displayResult.equipmentKind)}
      mainDisplay={displayResult.primaryLabel}
      subInfo={displayResult.secondaryLabel}
      note={compact ? undefined : displayResult.plateBreakdownLabel || displayResult.warningLabel || displayResult.reasonLabel}
      state={mapState(displayResult)}
    />

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
