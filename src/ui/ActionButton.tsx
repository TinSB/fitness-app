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
  secondary: 'border-white/10 bg-white/10 text-white hover:bg-white/[0.14] active:bg-white/[0.18]',
  ghost: 'border-transparent bg-transparent text-white/70 hover:bg-white/10 active:bg-white/[0.14]',
  danger: 'border-rose-400/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15 active:bg-rose-400/20',
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
      'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/30 disabled:shadow-none disabled:hover:bg-white/[0.04] disabled:active:bg-white/[0.04]',
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
