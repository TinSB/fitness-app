import type { ReactNode, KeyboardEvent } from 'react';
import { SafeAreaHeader } from './SafeAreaHeader';

interface BottomSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnHandle?: boolean;
}

export const BottomSheet = ({
  open,
  title,
  children,
  onClose,
  showCloseButton = false,
  closeOnBackdrop = true,
  closeOnHandle = true,
}: BottomSheetProps) => {
  if (!open) return null;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-[2px] md:items-center md:justify-center" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label="关闭底部面板"
        className="absolute inset-0"
        data-bottom-sheet-backdrop="dismiss"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[86svh] w-full overflow-hidden rounded-t-xl border border-white/10 bg-[#1c1c1e] pb-[env(safe-area-inset-bottom)] text-white shadow-xl shadow-black/40 md:max-w-xl md:rounded-xl"
        data-theme-surface="bottom_sheet"
        data-theme-mode="dark"
        data-training-sheet-layer="one-layer"
      >
        <button
          type="button"
          aria-label="收起底部面板"
          className="mx-auto mt-3 block h-3 w-16 rounded-full"
          data-bottom-sheet-handle="dismiss"
          onClick={closeOnHandle ? onClose : undefined}
        >
          <span className="mx-auto block h-1 w-9 rounded-full bg-white/20" />
        </button>
        <SafeAreaHeader title={title} onClose={showCloseButton ? onClose : undefined} className="md:pt-3" />
        <div className="max-h-[70svh] overflow-y-auto bg-[#1c1c1e] p-4 text-white">{children}</div>
      </section>
    </div>
  );
};
