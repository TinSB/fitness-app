import type { ComponentType } from 'react';
import { classNames } from '../../engines/engineUtils';

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
};

export function FloatingBottomNav<T extends string>({
  items,
  activeId,
  onNavigate,
  activeSession = false,
  trainTabId,
  hidden = false,
}: FloatingBottomNavProps<T>) {
  return (
    <nav
      aria-label="主导航"
      aria-hidden={hidden ? 'true' : undefined}
      data-bottom-nav-hidden={hidden ? 'true' : 'false'}
      data-bottom-nav-background="dark"
      data-bottom-nav-surface="dark-safe-area"
      className={classNames(
        'fixed bottom-0 left-0 right-0 bg-[linear-gradient(to_top,#0a0a0b_0%,rgba(10,10,11,0.96)_58%,rgba(10,10,11,0)_100%)] pb-[calc(2rem+env(safe-area-inset-bottom))] px-4 z-40 pointer-events-none transition-all duration-300 lg:hidden',
        hidden ? 'translate-y-[calc(100%+env(safe-area-inset-bottom))] opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      <div
        className="mx-auto flex w-full max-w-md items-center justify-around py-3 px-2 rounded-2xl backdrop-blur-2xl pointer-events-auto"
        style={{
          background: 'rgba(28, 28, 30, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        }}
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
                isActive ? 'text-emerald-400' : 'text-white/35 active:text-white/50',
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
