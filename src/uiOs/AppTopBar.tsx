import { Dumbbell } from 'lucide-react';

interface AppTopBarProps<T extends string> {
  activeSession?: boolean;
  trainTabId: T;
  onNavigate: (id: T) => void;
}

export const AppTopBar = <T extends string>({ activeSession = false, trainTabId, onNavigate }: AppTopBarProps<T>) => (
  <div className="flex h-[calc(56px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0b]/80 px-4 pt-[env(safe-area-inset-top)] text-white backdrop-blur-xl lg:hidden">
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white text-black">
        <Dumbbell className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[17px] font-semibold tracking-tight">IronPath</div>
        <div className="text-[11px] text-white/45">私人力量训练系统</div>
      </div>
    </div>
    {activeSession ? (
      <button
        type="button"
        onClick={() => onNavigate(trainTabId)}
        className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-2 text-xs font-semibold text-emerald-100"
      >
        训练中
      </button>
    ) : null}
  </div>
);
