import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  fullWidth?: boolean;
}

const variants: Record<ActionButtonVariant, string> = {
  primary: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-stone-50 active:bg-slate-100',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger: 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50 active:bg-rose-100',
};

const sizes: Record<ActionButtonSize, string> = {
  sm: 'min-h-9 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-14 px-5 py-3 text-base',
};

export const ActionButton = ({ variant = 'secondary', size = 'md', fullWidth = false, className, children, type = 'button', ...props }: ActionButtonProps) => (
  <button
    type={type}
    className={classNames(
      'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
      variants[variant],
      sizes[size],
      fullWidth && 'w-full',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
