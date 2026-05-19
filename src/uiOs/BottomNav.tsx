import type { ComponentType } from 'react';
import { classNames } from '../engines/engineUtils';

export type UiOsBottomNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

interface BottomNavProps<T extends string> {
  items: ReadonlyArray<UiOsBottomNavItem<T>>;
  activeId: T;
  onNavigate: (id: T) => void;
  activeSession?: boolean;
}

export const BottomNav = <T extends string>({ items, activeId, onNavigate, activeSession = false }: BottomNavProps<T>) => (
  <nav
    aria-label="主导航"
    className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden"
  >
    <div className="grid w-full max-w-md grid-cols-5 gap-1 rounded-[28px] border border-white/10 bg-black/70 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            data-active={selected ? 'true' : 'false'}
            onClick={() => onNavigate(item.id)}
            className={classNames(
              'relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition',
              selected ? 'bg-white text-black shadow-sm' : 'text-white/45 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon className="h-5 w-5 stroke-[2]" />
            <span>{item.label}</span>
            {item.id === 'train' && activeSession ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" /> : null}
          </button>
        );
      })}
    </div>
  </nav>
);
