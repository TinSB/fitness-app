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
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[1px]">
      <aside role="dialog" aria-modal="true" aria-label={title} className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-xl shadow-slate-950/10">
        <SafeAreaHeader title={title} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
};
