import { useEffect, type ReactNode } from 'react';
import { SafeAreaHeader } from './SafeAreaHeader';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';
import { resolveThemeSurface } from '../uiOs/theme/themeSurfaceModel';

interface BottomSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnHandle?: boolean;
}

export const BottomSheet = ({
  open,
  title,
  children,
  onClose,
  showCloseButton = false,
  closeOnBackdrop = true,
  closeOnHandle = true,
}: BottomSheetProps) => {
  const { selectedThemeMode, resolvedTheme } = useUiTheme();
  const surface = resolveThemeSurface('bottom_sheet', selectedThemeMode, { systemPrefersDark: resolvedTheme === 'dark' });
  const isDark = surface.resolvedMode === 'dark';
  // Bug #16 修复：原先 onKeyDown 绑在不可聚焦的外层 <div> 上，焦点不在 sheet 内可聚焦元素时
  // Escape 无法触发关闭。改为全局监听，仅 sheet 打开时挂载、关闭时清理。
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-[2px] md:items-center md:justify-center">
      <button
        type="button"
        aria-label="关闭底部面板"
        className="absolute inset-0"
        data-bottom-sheet-backdrop="dismiss"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={classNames(
          'relative max-h-[86svh] w-full overflow-hidden rounded-t-xl pb-[env(safe-area-inset-bottom)] shadow-xl md:max-w-xl md:rounded-xl',
          surface.className,
          surface.textClassName,
          isDark ? 'shadow-black/40' : 'shadow-slate-950/10',
        )}
        data-theme-surface="bottom_sheet"
        data-theme-mode={surface.resolvedMode}
        data-training-sheet-layer="one-layer"
      >
        <button
          type="button"
          aria-label="收起底部面板"
          className="mx-auto mt-3 block h-3 w-16 rounded-full"
          data-bottom-sheet-handle="dismiss"
          onClick={closeOnHandle ? onClose : undefined}
        >
          <span className={classNames('mx-auto block h-1 w-9 rounded-full', isDark ? 'bg-white/20' : 'bg-slate-300')} />
        </button>
        <SafeAreaHeader title={title} onClose={showCloseButton ? onClose : undefined} className="md:pt-3" />
        <div className={classNames('max-h-[70svh] overflow-y-auto p-4', isDark ? 'bg-[#1c1c1e] text-white' : 'bg-white text-slate-950')}>{children}</div>
      </section>
    </div>
  );
};
