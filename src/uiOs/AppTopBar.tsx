import { Dumbbell } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import type { ResolvedTheme } from '../engines/themePreferenceModel';

interface AppTopBarProps<T extends string> {
  activeSession?: boolean;
  trainTabId: T;
  onNavigate: (id: T) => void;
  themeMode?: ResolvedTheme;
}

export const AppTopBar = <T extends string>({ activeSession = false, trainTabId, onNavigate, themeMode = 'dark' }: AppTopBarProps<T>) => {
  const isDark = themeMode === 'dark';
  return (
  <div
    className={classNames(
      'flex h-[calc(56px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden',
      isDark ? 'border-white/10 bg-[#0a0a0b]/80 text-white' : 'border-slate-200 bg-white/82 text-slate-950',
    )}
    data-top-bar-theme={themeMode}
  >
    <div className="flex items-center gap-3">
      <div className={classNames('grid h-9 w-9 place-items-center rounded-2xl', isDark ? 'bg-white text-black' : 'bg-slate-950 text-white')}>
        <Dumbbell className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[17px] font-semibold tracking-tight">IronPath</div>
        <div className={classNames('text-[11px]', isDark ? 'text-white/45' : 'text-slate-500')}>私人力量训练系统</div>
      </div>
    </div>
    {activeSession ? (
      <button
        type="button"
        onClick={() => onNavigate(trainTabId)}
        className={classNames(
          'rounded-full border px-3 py-2 text-xs font-semibold',
          isDark ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        )}
      >
        训练中
      </button>
    ) : null}
  </div>
  );
};
