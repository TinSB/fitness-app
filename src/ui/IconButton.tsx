import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
}

export const IconButton = ({ label, icon, active, className, type = 'button', ...props }: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={classNames(
      'inline-grid min-h-11 min-w-11 place-items-center rounded-lg border text-sm font-medium transition',
      active ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-stone-50',
      className
    )}
    {...props}
  >
    {icon}
  </button>
);
