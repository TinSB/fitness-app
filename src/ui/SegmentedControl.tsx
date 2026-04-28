import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ id: T; label: string; mobileLabel?: string; badge?: ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export const SegmentedControl = <T extends string>({ value, options, onChange, ariaLabel = '分区导航', className }: SegmentedControlProps<T>) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={classNames('flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}
  >
    {options.map((option) => {
      const selected = value === option.id;
      return (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(option.id)}
          className={classNames(
            'min-h-10 shrink-0 rounded-md px-3 text-sm font-medium transition',
            selected ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-stone-50',
          )}
        >
          <span className="sm:hidden">{option.mobileLabel || option.label}</span>
          <span className="hidden sm:inline">{option.label}</span>
          {option.badge ? <span className="ml-2">{option.badge}</span> : null}
        </button>
      );
    })}
  </div>
);
