import { useRef, useState, type UIEvent, type ReactNode } from 'react';
import { Dumbbell } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { AppTopBar } from './AppTopBar';
import { BottomNav, type UiOsBottomNavItem } from './BottomNav';
import { SafetyStrip } from './surfaces/SafetyStrip';
import { PageContainer } from './PageContainer';

interface MobileAppShellProps<T extends string> {
  navItems: ReadonlyArray<UiOsBottomNavItem<T>>;
  activeTab: T;
  onNavigate: (id: T) => void;
  trainTabId: T;
  activeSession?: boolean;
  auxiliary?: ReactNode;
  immersive?: boolean;
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
  children,
}: MobileAppShellProps<T>) => {
  const lastScrollTopRef = useRef(0);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);

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
  <div className="h-dvh min-h-dvh w-full overflow-hidden bg-[#0a0a0b] font-sans text-slate-100">
    <div className="flex h-full w-full">
      <aside className={classNames('hidden w-[244px] shrink-0 flex-col border-r border-white/10 bg-black/35 text-white backdrop-blur-xl lg:flex', immersive && 'lg:hidden')}>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-black">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">IronPath</div>
              <div className="text-xs text-white/45">私人力量训练系统</div>
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
                  selected ? 'bg-white text-black shadow-sm' : 'text-white/45 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.id === trainTabId && activeSession ? (
                  <span className="ml-auto rounded-full bg-emerald-300/15 px-2 py-0.5 text-[11px] text-emerald-200">训练中</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-white/45">
          当前使用本地数据。云端候选不会自动同步，本地训练记录仍可继续。
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%),#0a0a0b]">
        {!immersive ? <AppTopBar activeSession={activeSession} trainTabId={trainTabId} onNavigate={onNavigate} /> : null}
        {!immersive ? (
          <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 md:px-6 lg:px-8">
            <SafetyStrip includeSecondaryCopy />
          </div>
        ) : null}
        <div
          className={classNames('min-h-0 flex-1 overflow-y-auto lg:pb-0', immersive ? 'pb-0' : 'pb-28')}
          onScroll={handleShellScroll}
          data-shell-scroll-area="bottom-nav-aware"
        >
          <PageContainer auxiliary={auxiliary} immersive={immersive}>{children}</PageContainer>
        </div>
      </main>
    </div>

    {!immersive ? <BottomNav items={navItems} activeId={activeTab} onNavigate={onNavigate} activeSession={activeSession} hidden={bottomNavHidden} /> : null}
  </div>
  );
};
