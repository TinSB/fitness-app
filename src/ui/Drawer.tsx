import type { ReactNode } from 'react';
import { SafeAreaHeader } from './SafeAreaHeader';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';
import { resolveThemeSurface } from '../uiOs/theme/themeSurfaceModel';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const Drawer = ({ open, title, children, onClose }: DrawerProps) => {
  const { selectedThemeMode, resolvedTheme } = useUiTheme();
  const surface = resolveThemeSurface('training_detail_surface', selectedThemeMode, { systemPrefersDark: resolvedTheme === 'dark' });
  const isDark = surface.resolvedMode === 'dark';
  const darkDetailOverrides =
    '[&_.border-slate-200]:border-white/10 [&_.divide-slate-200]:divide-white/10 [&_.bg-amber-50]:bg-amber-400/10 [&_.bg-emerald-50]:bg-emerald-400/10 [&_.bg-rose-50]:bg-rose-400/10 [&_.bg-slate-50]:bg-white/[0.05] [&_.bg-stone-50]:bg-white/[0.05] [&_.bg-white]:bg-white/[0.06] [&_.text-black]:text-white [&_.text-slate-400]:text-white/35 [&_.text-slate-500]:text-white/45 [&_.text-slate-600]:text-white/58 [&_.text-slate-700]:text-white/70 [&_.text-slate-900]:text-white [&_.text-slate-950]:text-white';
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={classNames(
          'ml-auto flex h-full w-full max-w-xl flex-col border-l shadow-xl',
          isDark ? 'border-white/10 bg-[#0a0a0b] text-white shadow-black/40' : 'border-slate-200 bg-slate-50 text-slate-950 shadow-slate-950/10',
        )}
        data-theme-surface="modal_surface"
        data-theme-mode={surface.resolvedMode}
        data-training-detail-surface={surface.resolvedMode}
      >
        <SafeAreaHeader title={title} onClose={onClose} />
        <div
          className={classNames(
            'min-h-0 flex-1 overflow-y-auto p-4',
            isDark ? 'bg-[#0a0a0b] text-white' : 'bg-slate-50 text-slate-950',
            isDark ? darkDetailOverrides : '',
          )}
          data-theme-surface="training_detail_surface"
          data-record-detail-surface={surface.resolvedMode}
        >
          {children}
        </div>
      </aside>
    </div>
  );
};
