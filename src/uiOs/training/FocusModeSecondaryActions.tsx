import React, { type ReactNode } from 'react';
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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FocusModeSecondaryActions({ actions, isOpen, onOpenChange }: FocusModeSecondaryActionsProps) {
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <div data-focus-secondary-actions="visual-secondary" data-focus-secondary-mode={isOpen ? 'more-open' : 'more-closed'}>
      <ActionButton type="button" variant="secondary" size="sm" fullWidth onClick={() => onOpenChange(true)} aria-expanded={isOpen} aria-controls="focus-more-actions-panel">
        更多
      </ActionButton>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm" data-focus-more-backdrop="dismiss" onClick={() => onOpenChange(false)}>
          <div
            id="focus-more-actions-panel"
            className="relative w-full rounded-t-3xl border border-white/10 bg-[#1c1c1e]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-[0_-18px_70px_rgba(0,0,0,0.35)]"
            data-focus-secondary-actions-panel="visual-secondary"
            data-theme-surface="bottom_sheet"
            data-theme-mode="dark"
            onClick={() => onOpenChange(false)}
          >
            <button
              type="button"
              aria-label="收起更多操作"
              className="mx-auto mb-4 block h-3 w-16 rounded-full"
              data-focus-more-handle="dismiss"
              onClick={() => onOpenChange(false)}
            >
              <span className="mx-auto block h-1 w-9 rounded-full bg-white/20" />
            </button>
            <div className="grid grid-cols-3 gap-2" data-focus-more-action-grid="protected" onClick={(event) => event.stopPropagation()}>
              {actions.map((action) => (
                <ActionButton
                  key={action.id}
                  type="button"
                  variant={action.tone === 'danger' || action.active ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    action.onClick();
                    onOpenChange(false);
                  }}
                  disabled={action.disabled}
                  className={classNames('min-h-14 flex-col px-2 text-xs', action.tone === 'success' && !action.active ? 'text-emerald-200' : '')}
                  aria-label={action.label}
                >
                  {action.icon}
                  <span className="font-semibold leading-tight">{action.label}</span>
                </ActionButton>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
