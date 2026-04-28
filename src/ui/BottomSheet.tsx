import type { ReactNode } from 'react';
import { SafeAreaHeader } from './SafeAreaHeader';

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
        <SafeAreaHeader title={title} onClose={onClose} className="md:pt-3" />
        <div className="max-h-[70svh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
};
