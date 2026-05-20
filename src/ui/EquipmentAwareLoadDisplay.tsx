import React from 'react';
import type { EquipmentAwareRecommendationDisplayResult } from '../engines/equipmentAwareRecommendationDisplay';
import { classNames } from '../engines/engineUtils';
import { EquipmentAwareLoadCard, type EquipmentLoadType } from '../uiOs/training/EquipmentAwareLoadCard';
import { BottomSheet } from '../uiOs/surfaces/BottomSheet';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

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
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const secondaryItems = [
    displayResult.secondaryLabel,
    displayResult.plateBreakdownLabel,
    displayResult.warningLabel,
  ].filter((item, index, items): item is string => Boolean(item) && items.indexOf(item) === index);
  const conciseDetailLabel = displayResult.detailLabel.split('；理论计算')[0] || displayResult.detailLabel;
  const detailItems = [
    conciseDetailLabel,
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
      {primaryLabel ? <div className={classNames('mb-2 text-xs font-semibold', isDark ? 'text-white/58' : 'text-slate-600')}>{primaryLabel}</div> : null}
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
        className={classNames(
          'mt-2 w-full rounded-2xl border px-3 py-2 text-left text-sm font-semibold leading-6',
          isDark ? 'border-white/10 bg-white/[0.045] text-white' : 'border-slate-200 bg-slate-50 text-slate-700',
        )}
        data-equipment-weight-details="collapsed"
        data-theme-surface="compact_row"
        onClick={() => setDetailsOpen(true)}
      >
        重量详情
      </button>
      <BottomSheet isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="重量详情" themeMode={resolvedTheme}>
        <div className={classNames('space-y-2 text-sm leading-6', isDark ? 'text-white/70' : 'text-slate-600')} data-equipment-weight-details-sheet="collapsed-by-default">
          {detailItems.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </BottomSheet>

      {onOpenEquipmentProfile ? (
        <button type="button" onClick={onOpenEquipmentProfile} className={classNames('mt-2 text-xs font-semibold', isDark ? 'text-emerald-200' : 'text-emerald-700')}>
          配置器械档案
        </button>
      ) : null}
    </section>
  );
};
