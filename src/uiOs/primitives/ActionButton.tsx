import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

export type UiOsActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type UiOsActionButtonSize = 'sm' | 'md' | 'lg';

export type UiOsActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: UiOsActionButtonVariant;
  size?: UiOsActionButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
};

const sizeStyles: Record<UiOsActionButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm rounded-xl min-h-[40px]',
  md: 'px-5 py-3.5 text-base rounded-2xl min-h-[52px]',
  lg: 'px-6 py-4 text-lg rounded-2xl min-h-[60px]',
};

const getVariantStyles = (variant: UiOsActionButtonVariant, disabled?: boolean) => {
  if (variant === 'primary') return disabled ? 'bg-emerald-500/30 text-white/40' : 'bg-emerald-500 text-white font-semibold active:bg-emerald-600 active:scale-[0.98]';
  if (variant === 'secondary') return disabled ? 'bg-white/5 text-white/30' : 'bg-white/10 text-white font-medium active:bg-white/15 active:scale-[0.98]';
  if (variant === 'danger') return disabled ? 'bg-red-500/20 text-white/40' : 'bg-red-500/15 text-red-400 font-medium active:bg-red-500/25 active:scale-[0.98]';
  return disabled ? 'text-white/30' : 'text-white/70 font-medium active:bg-white/5 active:scale-[0.98]';
};

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  ...buttonProps
}: UiOsActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={isDisabled}
      className={classNames(
        'transition-all duration-150 flex items-center justify-center gap-2',
        sizeStyles[size],
        getVariantStyles(variant, isDisabled),
        fullWidth ? 'w-full' : '',
        className,
      )}
    >
      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="loading" /> : children}
    </button>
  );
}
