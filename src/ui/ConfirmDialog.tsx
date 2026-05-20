import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';
import { resolveThemeSurface } from '../uiOs/theme/themeSurfaceModel';

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
  const { selectedThemeMode, resolvedTheme } = useUiTheme();
  const surface = resolveThemeSurface('modal_surface', selectedThemeMode, { systemPrefersDark: resolvedTheme === 'dark' });
  const isDark = surface.resolvedMode === 'dark';
  const tone: ConfirmDialogVariant = danger ? 'danger' : variant;
  const visibleText = (value?: string) => {
    const text = String(value || '').trim();
    return text.length ? text : undefined;
  };
  const isSetAnomalyDialog = title.includes('确认保存这组');
  const resolvedConfirmText = visibleText(confirmText) || visibleText(confirmLabel) || (isSetAnomalyDialog ? '仍然保存' : '确认');
  const resolvedCancelText = visibleText(cancelText) || visibleText(cancelLabel) || (isSetAnomalyDialog ? '返回修改' : '取消');
  const confirmVariant = tone === 'danger' ? 'danger' : tone === 'warning' ? 'secondary' : 'primary';

  return (
  <section
    role="dialog"
    aria-modal="true"
    aria-label={title}
    className={classNames('w-full max-w-sm rounded-xl p-4 shadow-xl', surface.className, surface.textClassName, isDark ? 'shadow-black/40' : 'shadow-slate-950/10')}
    data-theme-surface="modal_surface"
    data-theme-mode={surface.resolvedMode}
  >
    <h2 className={classNames('text-lg font-semibold leading-7', isDark ? 'text-white' : 'text-slate-950')}>{title}</h2>
    <div className={classNames('mt-2 max-h-[55svh] overflow-y-auto pr-1 text-sm leading-6', isDark ? 'text-white/58' : 'text-slate-600')}>{description}</div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <ActionButton variant="secondary" size="lg" aria-label={resolvedCancelText} onClick={onCancel}>
        {resolvedCancelText}
      </ActionButton>
      <ActionButton
        variant={confirmVariant}
        size="lg"
        aria-label={resolvedConfirmText}
        className={tone === 'warning' ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700' : undefined}
        onClick={onConfirm}
      >
        {resolvedConfirmText}
      </ActionButton>
    </div>
  </section>
  );
};
