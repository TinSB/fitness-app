import type { ComponentType } from 'react';
import { classNames } from '../engines/engineUtils';

export type BottomNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

interface BottomNavProps<T extends string> {
  items: ReadonlyArray<BottomNavItem<T>>;
  activeId: T;
  onNavigate: (id: T) => void;
  activeSession?: boolean;
}

export const BottomNav = <T extends string>({ items, activeId, onNavigate, activeSession }: BottomNavProps<T>) => (
  <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    {items.map((item) => {
      const Icon = item.icon;
      const selected = activeId === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className={classNames(
            'relative mx-0.5 my-1 flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition',
            selected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          )}
        >
          <Icon className="h-5 w-5 stroke-[2]" />
          <span>{item.label}</span>
          {item.id === 'training' && activeSession ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" /> : null}
        </button>
      );
    })}
  </nav>
);
