import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

export type UiOsBadgeState = 'safe' | 'info' | 'warning' | 'danger' | 'disabled' | 'manual-required';

export type UiOsStatusBadgeProps = {
  state?: UiOsBadgeState;
  children: ReactNode;
  className?: string;
};

const stateStyles: Record<UiOsBadgeState, string> = {
  safe: 'bg-emerald-500/15 text-emerald-400',
  info: 'bg-blue-500/15 text-blue-400',
  warning: 'bg-amber-500/15 text-amber-400',
  danger: 'bg-red-500/15 text-red-400',
  disabled: 'bg-white/8 text-white/40',
  'manual-required': 'bg-orange-500/15 text-orange-400',
};

export function StatusBadge({ state = 'info', children, className = '' }: UiOsStatusBadgeProps) {
  return (
    <span className={classNames('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium', stateStyles[state], className)}>
      {children}
    </span>
  );
}
