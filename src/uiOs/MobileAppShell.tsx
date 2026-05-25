import { useRef, useState, type UIEvent, type ReactNode } from 'react';
import { Dumbbell } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { AppTopBar } from './AppTopBar';
import { BottomNav, type UiOsBottomNavItem } from './BottomNav';
import { PageContainer } from './PageContainer';
import type { ThemePreferenceResult } from '../engines/themePreferenceModel';
import { UiThemeProvider } from './theme/UiThemeProvider';

interface MobileAppShellProps<T extends string> {
  navItems: ReadonlyArray<UiOsBottomNavItem<T>>;
  activeTab: T;
  onNavigate: (id: T) => void;
  trainTabId: T;
  activeSession?: boolean;
  auxiliary?: ReactNode;
  immersive?: boolean;
  themePreference?: ThemePreferenceResult;
  children: ReactNode;
}

export const MobileAppShell = <T extends string>({
  navItems,
  activeTab,
  onNavigate,
  trainTabId,
  activeSession = false,
  auxiliary,
  immersive = false,
  themePreference,
  children,
}: MobileAppShellProps<T>) => {
  const lastScrollTopRef = useRef(0);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const resolvedTheme = immersive ? 'dark' : themePreference?.resolvedTheme || 'dark';
  const selectedThemeMode = immersive ? 'dark' : themePreference?.selectedThemeMode || 'dark';
  const isDark = resolvedTheme === 'dark';

  const handleShellScroll = (event: UIEvent<HTMLDivElement>) => {
    if (immersive) return;
    const element = event.currentTarget;
    const currentScrollTop = element.scrollTop;
    const delta = currentScrollTop - lastScrollTopRef.current;
    const nearTop = currentScrollTop < 24;
    const nearBottom = element.scrollHeight - element.clientHeight - currentScrollTop < 48;

    if (nearTop || nearBottom || delta < -8) {
      setBottomNavHidden(false);
    } else if (delta > 12 && currentScrollTop > 80) {
      setBottomNavHidden(true);
    }

    lastScrollTopRef.current = currentScrollTop;
  };

  return (
  <UiThemeProvider value={{ selectedThemeMode, resolvedTheme, focusModeImmersiveDark: true }}>
  <div
    className={classNames(
      'h-dvh min-h-dvh w-full overflow-hidden font-sans transition-colors duration-200',
      themePreference?.shellThemeClass,
      isDark ? 'bg-[#0a0a0b] text-slate-100' : 'bg-slate-50 text-slate-950',
    )}
    data-app-chrome-background={resolvedTheme}
    data-ui-theme={resolvedTheme}
  >
    <div className="flex h-full w-full">
      <aside className={classNames('hidden w-[244px] shrink-0 flex-col border-r backdrop-blur-xl lg:flex', isDark ? 'border-white/10 bg-black/35 text-white' : 'border-slate-200 bg-white/80 text-slate-950', immersive && 'lg:hidden')}>
        <div className={classNames('border-b px-5 py-5', isDark ? 'border-white/10' : 'border-slate-200')}>
          <div className="flex items-center gap-3">
            <div className={classNames('grid h-10 w-10 place-items-center rounded-2xl', isDark ? 'bg-white text-black' : 'bg-slate-950 text-white')}>
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">IronPath</div>
              <div className={classNames('text-xs', isDark ? 'text-white/45' : 'text-slate-500')}>私人力量训练系统</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition',
                  selected
                    ? isDark ? 'bg-white text-black shadow-sm' : 'bg-slate-950 text-white shadow-sm'
                    : isDark ? 'text-white/45 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.id === trainTabId && activeSession ? (
                  <span className={classNames('ml-auto rounded-full px-2 py-0.5 text-[11px]', isDark ? 'bg-emerald-300/15 text-emerald-200' : 'bg-emerald-100 text-emerald-700')}>训练中</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className={classNames('border-t px-5 py-4 text-xs leading-5', isDark ? 'border-white/10 text-white/45' : 'border-slate-200 text-slate-500')}>
          本地优先 · 手动候选
        </div>
      </aside>

      <main className={classNames('flex min-w-0 flex-1 flex-col', isDark ? 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%),#0a0a0b]' : 'bg-slate-50')}>
        {!immersive ? <AppTopBar activeSession={activeSession} trainTabId={trainTabId} onNavigate={onNavigate} themeMode={resolvedTheme} /> : null}
        <div
          className={classNames(
            'min-h-0 flex-1 overflow-y-auto lg:pb-0',
            isDark ? 'bg-[#0a0a0b]' : 'bg-slate-50',
            immersive ? 'pb-0' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
          )}
          onScroll={handleShellScroll}
          data-shell-scroll-area="bottom-nav-aware"
          data-shell-safe-bottom={immersive ? 'immersive' : 'bottom-nav-protected'}
          data-shell-bottom-background={resolvedTheme}
          data-shell-bottom-reserve={immersive ? 'none' : 'tap-clearance'}
        >
          <PageContainer auxiliary={auxiliary} immersive={immersive}>{children}</PageContainer>
        </div>
      </main>
    </div>

    {!immersive ? <BottomNav items={navItems} activeId={activeTab} onNavigate={onNavigate} activeSession={activeSession} hidden={bottomNavHidden} themeMode={resolvedTheme} /> : null}
  </div>
  </UiThemeProvider>
  );
};
