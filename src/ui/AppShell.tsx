import type { ReactNode } from 'react';
import { Dumbbell } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { BottomNav, type BottomNavItem } from './BottomNav';

interface AppShellProps<T extends string> {
  navItems: ReadonlyArray<BottomNavItem<T>>;
  activeTab: T;
  onNavigate: (id: T) => void;
  activeSession?: boolean;
  auxiliary?: ReactNode;
  immersive?: boolean;
  children: ReactNode;
}

export const AppShell = <T extends string>({ navItems, activeTab, onNavigate, activeSession, auxiliary, immersive = false, children }: AppShellProps<T>) => (
  <div className="h-dvh min-h-dvh w-full overflow-hidden bg-stone-100 font-sans text-slate-900">
    <div className="flex h-full w-full">
      <aside className={classNames('hidden w-[244px] shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-white lg:flex', immersive && 'lg:hidden')}>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-slate-950">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">IronPath</div>
              <div className="text-xs text-slate-400">私人力量训练系统</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition',
                  selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.id === 'training' && activeSession ? (
                  <span className="ml-auto rounded-md bg-emerald-400/20 px-2 py-0.5 text-[11px] text-emerald-200">训练中</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-400">
          打开即可开始训练。记录、处方、纠偏和趋势都保存在本地。
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-stone-50">
        <div
          className={classNames(
            'flex h-[calc(48px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 pt-[env(safe-area-inset-top)] lg:hidden',
            immersive && 'hidden',
          )}
        >
          <div className="flex items-center gap-2 font-semibold text-slate-950">
            <Dumbbell className="h-5 w-5 text-emerald-600" />
            IronPath
          </div>
          {activeSession ? (
            <button type="button" onClick={() => onNavigate('training' as T)} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
              训练中
            </button>
          ) : null}
        </div>
        <div className={classNames('min-h-0 flex-1 overflow-y-auto lg:pb-0', immersive ? 'pb-0' : 'pb-24')}>
          <div
            className={classNames(
              'mx-auto w-full max-w-[1600px]',
              auxiliary && !immersive ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6' : '',
            )}
          >
            <section className="min-w-0">{children}</section>
            {auxiliary && !immersive ? (
              <aside className="hidden min-w-0 px-4 py-6 lg:block xl:px-6">
                <div className="sticky top-6 space-y-3">{auxiliary}</div>
              </aside>
            ) : null}
          </div>
        </div>
      </main>
    </div>

    {!immersive ? <BottomNav items={navItems} activeId={activeTab} onNavigate={onNavigate} activeSession={activeSession} /> : null}
  </div>
);
