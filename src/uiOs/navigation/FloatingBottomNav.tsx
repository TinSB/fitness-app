import type { ComponentType } from 'react';
import { classNames } from '../../engines/engineUtils';
import type { ResolvedTheme } from '../../engines/themePreferenceModel';

export type FloatingBottomNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type FloatingBottomNavProps<T extends string> = {
  items: ReadonlyArray<FloatingBottomNavItem<T>>;
  activeId: T;
  onNavigate: (id: T) => void;
  activeSession?: boolean;
  trainTabId?: T;
  hidden?: boolean;
  themeMode?: ResolvedTheme;
};

export function FloatingBottomNav<T extends string>({
  items,
  activeId,
  onNavigate,
  activeSession = false,
  trainTabId,
  hidden = false,
  themeMode = 'dark',
}: FloatingBottomNavProps<T>) {
  const isDark = themeMode === 'dark';
  return (
    <nav
      aria-label="主导航"
      aria-hidden={hidden ? 'true' : undefined}
      data-bottom-nav-hidden={hidden ? 'true' : 'false'}
      data-bottom-nav-background={themeMode}
      data-bottom-nav-surface={`${themeMode}-safe-area`}
      data-bottom-nav-safe-area="covered"
      className={classNames(
        'fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 pointer-events-none transition-all duration-300 lg:hidden',
        isDark ? 'bg-[#101012]/95' : 'bg-slate-50/95',
        hidden ? 'translate-y-[calc(100%+0.5rem+env(safe-area-inset-bottom))] opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      <div
        className={classNames(
          'mx-auto flex w-full max-w-md items-center justify-around rounded-2xl border px-2 py-2.5 backdrop-blur-2xl pointer-events-auto',
          isDark
            ? 'border-white/10 bg-[#1c1c1e]/88 shadow-[0_4px_30px_rgba(0,0,0,0.3)]'
            : 'border-slate-200 bg-white/92 shadow-[0_12px_34px_rgba(15,23,42,0.12)]',
        )}
        data-theme-surface="bottom_sheet"
        data-theme-mode={themeMode}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive ? 'true' : 'false'}
              className={classNames(
                'relative flex flex-col items-center gap-1 py-2 px-5 rounded-xl transition-all duration-200',
                isActive
                  ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                  : isDark ? 'text-white/35 active:text-white/50' : 'text-slate-500 active:text-slate-700',
              )}
              onClick={() => onNavigate(item.id)}
            >
              <Icon className={classNames('h-5 w-5 transition-transform', isActive ? 'scale-110' : '')} />
              <span className="text-[11px] font-medium">{item.label}</span>
              {trainTabId && item.id === trainTabId && activeSession ? <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-emerald-400" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
