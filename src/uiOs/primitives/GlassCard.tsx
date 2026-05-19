import type { CSSProperties, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

export type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg';

export type GlassCardProps = {
  children: ReactNode;
  className?: string;
  padding?: GlassCardPadding;
  onClick?: () => void;
  highlight?: boolean;
  as?: 'div' | 'section' | 'article';
  ariaLabel?: string;
};

const paddingMap: Record<GlassCardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

const glassCardStyle: CSSProperties = {
  background: 'rgba(44, 44, 46, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
};

export function GlassCard({
  children,
  className = '',
  padding = 'md',
  onClick,
  highlight = false,
  as: Component = 'div',
  ariaLabel,
}: GlassCardProps) {
  return (
    <Component
      className={classNames(
        'backdrop-blur-xl rounded-2xl',
        paddingMap[padding],
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150' : '',
        highlight ? 'ring-1 ring-emerald-500/30' : '',
        className,
      )}
      style={glassCardStyle}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Component>
  );
}
