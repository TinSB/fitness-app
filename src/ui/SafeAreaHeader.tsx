import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';
import { resolveThemeSurface } from '../uiOs/theme/themeSurfaceModel';

interface SafeAreaHeaderProps {
  title: string;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}

export const SafeAreaHeader = ({ title, onClose, closeLabel = '关闭', className, children }: SafeAreaHeaderProps) => {
  const { selectedThemeMode, resolvedTheme } = useUiTheme();
  const surface = resolveThemeSurface('modal_surface', selectedThemeMode, { systemPrefersDark: resolvedTheme === 'dark' });
  const isDark = surface.resolvedMode === 'dark';

  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-3 border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3',
        isDark ? 'border-white/10 bg-[#0a0a0b]/95 text-white' : 'border-slate-200 bg-white/95 text-slate-950',
        className
      )}
      data-theme-surface="modal_surface"
      data-theme-mode={surface.resolvedMode}
    >
      <div className="min-w-0">
        <h2 className={classNames('truncate text-lg font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{title}</h2>
        {children}
      </div>
      {onClose ? (
        <ActionButton size="sm" variant="ghost" onClick={onClose} aria-label={closeLabel}>
          {closeLabel}
        </ActionButton>
      ) : null}
    </div>
  );
};
