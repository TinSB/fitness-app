import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { resolveThemeSurface, type ThemeSurfaceMode } from '../theme/themeSurfaceModel';

export type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmRequired?: boolean;
  tone?: 'default' | 'danger';
  showConfirmCopy?: boolean;
  closeOnBackdrop?: boolean;
  closeOnHandle?: boolean;
  themeMode?: ThemeSurfaceMode;
  immersiveDark?: boolean;
};

const sheetStyle = (isDark: boolean): CSSProperties => ({
  background: isDark ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.96)',
  backdropFilter: 'blur(40px)',
  maxHeight: '85vh',
  animation: 'slideUp 0.3s ease-out',
});

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  confirmRequired = false,
  tone = 'default',
  showConfirmCopy = true,
  closeOnBackdrop = true,
  closeOnHandle = true,
  themeMode = 'dark',
  immersiveDark = false,
}: BottomSheetProps) {
  if (!isOpen) return null;
  const surface = resolveThemeSurface('bottom_sheet', themeMode, { immersiveDark });
  const isDark = surface.resolvedMode === 'dark';
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label="关闭底部面板"
        className={classNames('absolute inset-0 backdrop-blur-sm', isDark ? 'bg-black/60' : 'bg-slate-950/25')}
        data-bottom-sheet-backdrop="dismiss"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={classNames('relative w-full rounded-t-3xl p-6 pb-10', surface.className, surface.textClassName, tone === 'danger' ? 'border-t border-red-400/40' : '')}
        style={sheetStyle(isDark)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-bottom-sheet-tone={tone}
        data-theme-surface="bottom_sheet"
        data-theme-mode={surface.resolvedMode}
      >
        <button
          type="button"
          aria-label="收起底部面板"
          className="mx-auto mb-5 block h-3 w-16 rounded-full"
          data-bottom-sheet-handle="dismiss"
          onClick={closeOnHandle ? onClose : undefined}
        >
          <span className={classNames('mx-auto block h-1 w-9 rounded-full', isDark ? 'bg-white/20' : 'bg-slate-300')} />
        </button>
        <h3 className={classNames('mb-5 text-xl font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{title}</h3>
        <div className={classNames('overflow-y-auto', isDark ? 'text-white' : 'text-slate-950')}>{children}</div>
        {confirmRequired && showConfirmCopy ? (
          <div className={classNames('mt-5 border-t pt-4', isDark ? 'border-white/8' : 'border-slate-200')}>
            <p className={tone === 'danger' ? 'text-xs text-red-300 text-center' : 'text-xs text-amber-400 text-center'}>需要手动确认</p>
          </div>
        ) : null}
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
