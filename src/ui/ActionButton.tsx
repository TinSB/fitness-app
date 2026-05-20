import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

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

const lightVariants: Record<ActionButtonVariant, string> = {
  primary: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  secondary: 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-100',
};

const sizes: Record<ActionButtonSize, string> = {
  sm: 'min-h-9 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-14 px-5 py-3 text-base',
};

export const ActionButton = ({ variant = 'secondary', size = 'md', fullWidth = false, className, children, type = 'button', ...props }: ActionButtonProps) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type={type}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:shadow-none',
        isDark
          ? 'disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/30 disabled:hover:bg-white/[0.04] disabled:active:bg-white/[0.04]'
          : 'disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100 disabled:active:bg-slate-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        isDark ? variants[variant] : lightVariants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      data-theme-surface="action_surface"
      data-theme-mode={resolvedTheme}
      data-action-variant={variant}
      {...props}
    >
      {children}
    </button>
  );
};
