import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';
import type { UiTone } from './Card';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
}

const tones: Record<UiTone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-800',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-rose-800',
  sky: 'bg-sky-50 text-sky-800',
};

export const StatusBadge = ({ children, tone = 'slate', className }: StatusBadgeProps) => (
  <span className={classNames('inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold leading-none', tones[tone], className)}>
    {children}
  </span>
);
