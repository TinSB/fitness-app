import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { classNames } from '../engines/engineUtils';

interface SafeAreaHeaderProps {
  title: string;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}

export const SafeAreaHeader = ({ title, onClose, closeLabel = '关闭', className, children }: SafeAreaHeaderProps) => (
  <div
    className={classNames(
      'flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0a0b]/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white md:pt-3',
      className
    )}
    data-theme-surface="modal_surface"
    data-theme-mode="dark"
  >
    <div className="min-w-0">
      <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
    {onClose ? (
      <ActionButton size="sm" variant="ghost" onClick={onClose} aria-label={closeLabel}>
        {closeLabel}
      </ActionButton>
    ) : null}
  </div>
);
