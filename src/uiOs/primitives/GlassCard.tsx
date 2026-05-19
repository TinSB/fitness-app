import type { CSSProperties, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { resolveThemeSurface, type ThemeSurfaceMode, type ThemeSurfaceType } from '../theme/themeSurfaceModel';

export type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg';

export type GlassCardProps = {
  children: ReactNode;
  className?: string;
  padding?: GlassCardPadding;
  onClick?: () => void;
  highlight?: boolean;
  as?: 'div' | 'section' | 'article';
  ariaLabel?: string;
  surface?: ThemeSurfaceType;
  themeMode?: ThemeSurfaceMode;
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
  surface = 'glass_card',
  themeMode = 'dark',
}: GlassCardProps) {
  const resolvedSurface = resolveThemeSurface(surface, themeMode);
  return (
    <Component
      className={classNames(
        'backdrop-blur-xl rounded-2xl',
        resolvedSurface.className,
        resolvedSurface.textClassName,
        paddingMap[padding],
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150' : '',
        highlight ? 'ring-1 ring-emerald-500/30' : '',
        className,
      )}
      style={themeMode === 'dark' && surface === 'glass_card' ? glassCardStyle : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      data-theme-surface={surface}
      data-theme-mode={resolvedSurface.resolvedMode}
    >
      {children}
    </Component>
  );
}
