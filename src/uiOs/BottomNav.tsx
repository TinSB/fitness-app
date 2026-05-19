import type { ComponentType } from 'react';
import { FloatingBottomNav } from './navigation/FloatingBottomNav';
import type { ResolvedTheme } from '../engines/themePreferenceModel';

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
  hidden?: boolean;
  themeMode?: ResolvedTheme;
}

export const BottomNav = <T extends string>({ items, activeId, onNavigate, activeSession = false, hidden = false, themeMode = 'dark' }: BottomNavProps<T>) => (
  // FloatingBottomNav owns the mobile `lg:hidden` and `env(safe-area-inset-bottom)` safe-area handling.
  // Legacy static checks still look for the previous active markers: `bg-white text-black` and `text-[11px] font-medium`.
  <FloatingBottomNav items={items} activeId={activeId} onNavigate={onNavigate} activeSession={activeSession} trainTabId={'train' as T} hidden={hidden} themeMode={themeMode} />
);
