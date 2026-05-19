import type { CSSProperties } from 'react';
import { classNames } from '../../engines/engineUtils';

export type UiOsSegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type UiOsSegmentedControlProps<T extends string> = {
  options: ReadonlyArray<UiOsSegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
};

const segmentedStyle: CSSProperties = {
  background: 'rgba(118, 118, 128, 0.24)',
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: UiOsSegmentedControlProps<T>) {
  return (
    <div className={classNames('flex p-1 rounded-xl', className)} style={segmentedStyle} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = Boolean(option.disabled);

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={classNames(
              'flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200',
              isSelected ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm' : isDisabled ? 'text-white/25' : 'text-white/55 active:bg-white/10',
            )}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
