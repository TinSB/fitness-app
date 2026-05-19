import React from 'react';
import type { EquipmentAwareRecommendationDisplayResult } from '../engines/equipmentAwareRecommendationDisplay';
import { EquipmentAwareLoadCard, type EquipmentLoadType } from '../uiOs/training/EquipmentAwareLoadCard';
import { BottomSheet } from '../uiOs/surfaces/BottomSheet';

export type EquipmentAwareLoadDisplayProps = {
  displayResult: EquipmentAwareRecommendationDisplayResult;
  reps?: number | string;
  compact?: boolean;
  showDetails?: boolean;
  onOpenEquipmentProfile?: () => void;
  primaryLabel?: string;
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
  reps,
  compact = false,
  showDetails = false,
  onOpenEquipmentProfile,
  primaryLabel,
}: EquipmentAwareLoadDisplayProps) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const secondaryItems = [
    displayResult.secondaryLabel,
    displayResult.plateBreakdownLabel,
    displayResult.warningLabel,
  ].filter((item, index, items): item is string => Boolean(item) && items.indexOf(item) === index);
  const detailItems = [
    displayResult.detailLabel,
    displayResult.reasonLabel,
    displayResult.plateBreakdownLabel,
    displayResult.warningLabel,
  ].filter((item, index, items): item is string => Boolean(item) && items.indexOf(item) === index);

  return (
    <section
      aria-label="器械重量建议"
      data-equipment-aware-load-display="presentational"
      data-compact={compact ? 'true' : 'false'}
      data-equipment-details-collapsed="true"
    >
      {primaryLabel ? <div className="mb-2 text-xs font-semibold text-white/58">{primaryLabel}</div> : null}
      <EquipmentAwareLoadCard
        type={mapEquipmentKind(displayResult.equipmentKind)}
        mainDisplay={displayResult.primaryLabel}
        reps={reps}
        subInfo={secondaryItems.length ? secondaryItems.join(' · ') : undefined}
        state={mapState(displayResult)}
        compact={compact}
      />

      <button
        type="button"
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-left text-sm font-semibold leading-6 text-white"
        data-equipment-weight-details="collapsed"
        data-theme-surface="compact_row"
        onClick={() => setDetailsOpen(true)}
      >
        重量详情
      </button>
      <BottomSheet isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="重量详情">
        <div className="space-y-2 text-sm leading-6 text-white/70" data-equipment-weight-details-sheet="collapsed-by-default">
          {detailItems.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </BottomSheet>

      {onOpenEquipmentProfile ? (
        <button type="button" onClick={onOpenEquipmentProfile} className="mt-2 text-xs font-semibold text-emerald-200">
          配置器械档案
        </button>
      ) : null}
    </section>
  );
};
