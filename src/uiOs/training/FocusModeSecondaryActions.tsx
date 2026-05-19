import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { ActionButton } from '../primitives/ActionButton';

export type FocusModeSecondaryActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'success';
};

export type FocusModeSecondaryActionsProps = {
  actions: FocusModeSecondaryActionItem[];
};

export function FocusModeSecondaryActions({ actions }: FocusModeSecondaryActionsProps) {
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2" data-focus-secondary-actions="visual-secondary" data-focus-secondary-mode="more-collapsed">
      <summary className="cursor-pointer list-none text-center text-sm font-semibold text-white/70">更多</summary>
      <div className="mt-3 grid grid-cols-3 gap-2" data-focus-secondary-actions-panel="visual-secondary">
        {actions.map((action) => (
          <ActionButton
            key={action.id}
            type="button"
            variant={action.tone === 'danger' || action.active ? 'danger' : 'secondary'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={classNames('min-h-14 flex-col px-2 text-xs', action.tone === 'success' && !action.active ? 'text-emerald-200' : '')}
            aria-label={action.label}
          >
            {action.icon}
            <span className="font-semibold leading-tight">{action.label}</span>
          </ActionButton>
        ))}
      </div>
    </details>
  );
}
