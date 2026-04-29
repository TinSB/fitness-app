import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

export type ConfirmDialogVariant = 'default' | 'danger' | 'warning';

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  title,
  description,
  confirmText,
  cancelText,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const tone: ConfirmDialogVariant = danger ? 'danger' : variant;
  const resolvedConfirmText = confirmText || confirmLabel || '确认';
  const resolvedCancelText = cancelText || cancelLabel || '取消';
  const confirmVariant = tone === 'danger' ? 'danger' : tone === 'warning' ? 'secondary' : 'primary';

  return (
  <section
    role="dialog"
    aria-modal="true"
    aria-label={title}
    className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10"
  >
    <h2 className="text-lg font-semibold leading-7 text-slate-950">{title}</h2>
    <div className="mt-2 max-h-[55svh] overflow-y-auto pr-1 text-sm leading-6 text-slate-500">{description}</div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <ActionButton variant="secondary" size="lg" onClick={onCancel}>
        {resolvedCancelText}
      </ActionButton>
      <ActionButton
        variant={confirmVariant}
        size="lg"
        className={tone === 'warning' ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700' : undefined}
        onClick={onConfirm}
      >
        {resolvedConfirmText}
      </ActionButton>
    </div>
  </section>
  );
};
