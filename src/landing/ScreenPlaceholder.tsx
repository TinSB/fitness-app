import React from 'react';

/**
 * A reserved product-screenshot slot rendered inside the iPhone frame.
 * Intentionally blank and premium — a placeholder for a future real screen,
 * never a fake detailed UI.
 */
export function ScreenPlaceholder({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className="relative flex flex-col gap-3 rounded-lg border p-4"
      style={{
        borderRadius: 8,
        borderColor: active ? 'rgba(232,93,42,0.42)' : 'rgba(200,205,210,0.1)',
        background: active ? 'rgba(232,93,42,0.06)' : 'rgba(246,247,245,0.025)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: active ? 'var(--color-ember-500)' : 'var(--color-steel-600)' }}
          aria-hidden
        />
        <span
          className="text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: active ? 'var(--color-ember-300)' : 'var(--color-steel-600)' }}
        >
          {label}
        </span>
      </div>

      {/* Skeleton lines — quiet, reserved, not noisy */}
      <div className="flex flex-col gap-2">
        <div className="h-2.5 w-3/5 rounded-full" style={{ background: 'rgba(200,205,210,0.14)' }} />
        <div className="h-2.5 w-2/5 rounded-full" style={{ background: 'rgba(200,205,210,0.08)' }} />
      </div>
    </div>
  );
}
