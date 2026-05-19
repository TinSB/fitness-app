import type { ReactNode } from 'react';
import { SafeAreaHeader } from './SafeAreaHeader';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const Drawer = ({ open, title, children, onClose }: DrawerProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#0a0a0b] text-white shadow-xl shadow-black/40"
        data-theme-surface="modal_surface"
        data-theme-mode="dark"
        data-training-detail-surface="dark"
      >
        <SafeAreaHeader title={title} onClose={onClose} />
        <div
          className="min-h-0 flex-1 overflow-y-auto bg-[#0a0a0b] p-4 text-white [&_.border-slate-200]:border-white/10 [&_.divide-slate-200]:divide-white/10 [&_.bg-amber-50]:bg-amber-400/10 [&_.bg-emerald-50]:bg-emerald-400/10 [&_.bg-rose-50]:bg-rose-400/10 [&_.bg-slate-50]:bg-white/[0.05] [&_.bg-stone-50]:bg-white/[0.05] [&_.bg-white]:bg-white/[0.06] [&_.text-black]:text-white [&_.text-slate-400]:text-white/35 [&_.text-slate-500]:text-white/45 [&_.text-slate-600]:text-white/58 [&_.text-slate-700]:text-white/70 [&_.text-slate-900]:text-white [&_.text-slate-950]:text-white"
          data-theme-surface="modal_surface"
        >
          {children}
        </div>
      </aside>
    </div>
  );
};
