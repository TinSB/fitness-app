import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

interface BottomSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const BottomSheet = ({ open, title, children, onClose }: BottomSheetProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 backdrop-blur-[1px] md:items-center md:justify-center">
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[86svh] w-full overflow-hidden rounded-t-xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl shadow-slate-950/10 md:max-w-xl md:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <ActionButton size="sm" variant="ghost" onClick={onClose}>
            关闭
          </ActionButton>
        </div>
        <div className="max-h-[70svh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
};
