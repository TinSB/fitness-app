import React, { type ReactNode } from 'react';
import type { FocusPrimaryActionKind } from '../../engines/focusModeInteractionState';
import { WorkoutActionBar } from '../../ui/WorkoutActionBar';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';
import { FocusModeSecondaryActions, type FocusModeSecondaryActionItem } from './FocusModeSecondaryActions';

export type FocusModeActionBarProps = {
  primaryLabel: string;
  primaryActionKind: FocusPrimaryActionKind;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  secondaryActions: FocusModeSecondaryActionItem[];
  summary?: ReactNode;
  warning?: ReactNode;
};

export function FocusModeActionBar({
  primaryLabel,
  primaryActionKind,
  onPrimaryAction,
  primaryDisabled = false,
  secondaryActions,
  summary,
  warning,
}: FocusModeActionBarProps) {
  const primaryVariant = primaryActionKind === 'confirm_end_session' ? 'danger' : 'primary';
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <WorkoutActionBar className="border-white/10 bg-[#101012]/95 text-white shadow-[0_-14px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl pb-[max(0.625rem,env(safe-area-inset-bottom))] md:static md:pb-0" data-focus-bottom-safe-area="compact">
      <div className="mx-auto grid w-full max-w-2xl gap-2" data-focus-mode-action-bar="one-dominant-primary">
        <FocusModeSecondaryActions actions={secondaryActions} isOpen={moreOpen} onOpenChange={setMoreOpen} />
        {summary ? (
          <GlassCard padding="sm" className="rounded-2xl">
            {summary}
          </GlassCard>
        ) : null}
        {warning ? <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">{warning}</div> : null}
        <ActionButton
          type="button"
          aria-label={primaryLabel}
          data-primary-action-kind={primaryActionKind}
          onClick={onPrimaryAction}
          disabled={primaryDisabled}
          variant={primaryVariant}
          size="lg"
          fullWidth
          className="shadow-lg shadow-emerald-900/20"
        >
          {primaryLabel}
        </ActionButton>
      </div>
    </WorkoutActionBar>
  );
}
