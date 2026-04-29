import React from 'react';
import { ConfirmDialog, type ConfirmDialogVariant } from './ConfirmDialog';

export type ConfirmDialogOptions = {
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
};

type PendingConfirm = ConfirmDialogOptions & {
  resolve: (value: boolean) => void;
};

export const createConfirmDialogController = () => {
  let pending: PendingConfirm | null = null;

  return {
    confirm(options: ConfirmDialogOptions) {
      if (pending) pending.resolve(false);
      return new Promise<boolean>((resolve) => {
        pending = { ...options, resolve };
      });
    },
    resolve(value: boolean) {
      const current = pending;
      pending = null;
      current?.resolve(value);
    },
    getPending() {
      if (!pending) return null;
      return {
        title: pending.title,
        description: pending.description,
        confirmText: pending.confirmText,
        cancelText: pending.cancelText,
        variant: pending.variant,
      };
    },
  };
};

export const useConfirmDialog = () => {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const close = React.useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirm = React.useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  React.useEffect(() => {
    if (!pending || typeof window === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, pending]);

  const ConfirmDialogHost = React.useCallback(() => {
    if (!pending) return null;
    return (
      <div
        className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-[1px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close(false);
        }}
      >
        <ConfirmDialog
          title={pending.title}
          description={pending.description}
          confirmText={pending.confirmText}
          cancelText={pending.cancelText}
          variant={pending.variant}
          onCancel={() => close(false)}
          onConfirm={() => close(true)}
        />
      </div>
    );
  }, [close, pending]);

  return { confirm, ConfirmDialogHost };
};
