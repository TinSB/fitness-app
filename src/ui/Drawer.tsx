import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

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
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <ActionButton size="sm" variant="ghost" onClick={onClose}>
            关闭
          </ActionButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
};
