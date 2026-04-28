import type { ReactNode } from 'react';
import { Dumbbell } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { BottomNav, type BottomNavItem } from './BottomNav';

interface AppShellProps<T extends string> {
  navItems: ReadonlyArray<BottomNavItem<T>>;
  activeTab: T;
  onNavigate: (id: T) => void;
  activeSession?: boolean;
  children: ReactNode;
}

export const AppShell = <T extends string>({ navItems, activeTab, onNavigate, activeSession, children }: AppShellProps<T>) => (
  <div className="h-screen w-full overflow-hidden bg-stone-100 font-sans text-slate-900">
    <div className="h-full w-full md:p-3">
      <div className="h-full w-full overflow-hidden bg-white md:border md:border-slate-200 md:shadow-xl">
        <div className="flex h-full">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-white md:flex">
            <div className="border-b border-white/10 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500 text-slate-950">
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
                      'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition',
                      selected ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'
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

            <div className="border-t border-white/10 px-6 py-5 text-xs leading-5 text-slate-400">
              打开即可开始训练。记录、处方、纠偏和趋势都保存在本地。
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col bg-stone-50">
            <div className="flex min-h-[calc(52px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 pt-[env(safe-area-inset-top)] md:hidden">
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
            <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-0">{children}</div>
          </main>
        </div>
      </div>
    </div>

    <BottomNav items={navItems} activeId={activeTab} onNavigate={onNavigate} activeSession={activeSession} />
  </div>
);
