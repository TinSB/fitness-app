import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10">
    <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
    <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <ActionButton variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </ActionButton>
      <ActionButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmLabel}
      </ActionButton>
    </div>
  </section>
);
