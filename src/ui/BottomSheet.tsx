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
    <div className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-[2px] md:items-center md:justify-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[86svh] w-full overflow-hidden rounded-t-xl border border-white/10 bg-[#1c1c1e] pb-[env(safe-area-inset-bottom)] text-white shadow-xl shadow-black/40 md:max-w-xl md:rounded-xl"
        data-theme-surface="bottom_sheet"
        data-theme-mode="dark"
      >
        <SafeAreaHeader title={title} onClose={onClose} className="md:pt-3" />
        <div className="max-h-[70svh] overflow-y-auto bg-[#1c1c1e] p-4 text-white">{children}</div>
      </section>
    </div>
  );
};
