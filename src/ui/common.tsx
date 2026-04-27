import React, { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { TRAINING_MODE_META } from '../data/trainingData';
import type { CorrectionModule, FunctionalAddon, WeeklyPrescription } from '../models/training-model';
import { classNames, number } from '../engines/engineUtils';
import { formatSupportDoseAdjustment } from '../i18n/formatters';

type Tone = 'slate' | 'emerald' | 'amber' | 'rose';
type UiTone = Tone | 'sky';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface PageProps {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

interface StatProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
}

interface SegmentProps {
  value: string;
  options: readonly string[] | string[];
  labels?: Partial<Record<string, string>>;
  onChange: (value: string) => void;
}

interface ModeSwitchProps {
  value: string;
  onChange: (value: string) => void;
}

interface InfoPillProps {
  label: string;
  value: ReactNode;
}

interface LabelInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

interface WeeklyPrescriptionCardProps {
  weeklyPrescription: WeeklyPrescription;
  compact?: boolean;
}

interface SupportBlockListProps {
  title: string;
  subtitle: string;
  items?: Array<CorrectionModule | FunctionalAddon>;
  tone?: 'emerald' | 'amber';
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: UiTone;
  padded?: boolean;
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

interface SegmentedTabsProps<T extends string> {
  value: T;
  options: Array<{ id: T; label: string; badge?: ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

interface StatusBadgeProps {
  children: ReactNode;
  tone?: UiTone;
}

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

interface InlineNoticeProps {
  tone?: UiTone;
  title?: string;
  children: ReactNode;
}

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const Page = ({ eyebrow, title, action, children }: PageProps) => (
  <div className="mx-auto w-full max-w-7xl px-4 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:py-8">
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-700">{eyebrow}</div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const Card = ({ tone = 'slate', padded = true, className, children, ...props }: CardProps) => {
  const tones: Record<UiTone, string> = {
    slate: 'border-slate-200 bg-white text-slate-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
  };

  return (
    <section className={classNames('rounded-lg border shadow-sm shadow-slate-200/40', padded && 'p-4 md:p-5', tones[tone], className)} {...props}>
      {children}
    </section>
  );
};

export const SectionHeader = ({ eyebrow, title, description, action }: SectionHeaderProps) => (
  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div>
      {eyebrow ? <div className="text-xs font-black uppercase tracking-widest text-emerald-700">{eyebrow}</div> : null}
      <h2 className="mt-1 font-black text-slate-950">{title}</h2>
      {description ? <div className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</div> : null}
    </div>
    {action}
  </div>
);

export const ActionButton = ({ variant = 'secondary', size = 'md', fullWidth = false, className, children, type = 'button', ...props }: ActionButtonProps) => {
  const variants: Record<ButtonVariant, string> = {
    primary: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-stone-50',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3 py-2 text-xs',
    md: 'min-h-11 px-4 py-2.5 text-sm',
    lg: 'min-h-14 px-5 py-3 text-base',
  };

  return (
    <button
      type={type}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-black transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const SegmentedTabs = <T extends string>({ value, options, onChange, ariaLabel = '分区导航' }: SegmentedTabsProps<T>) => (
  <div className="overflow-x-auto pb-1" aria-label={ariaLabel}>
    <div className="grid min-w-max grid-flow-col auto-cols-max gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 md:min-w-0 md:auto-cols-fr">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={classNames(
              'min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-sm font-black transition',
              selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            {option.label}
            {option.badge ? <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{option.badge}</span> : null}
          </button>
        );
      })}
    </div>
  </div>
);

export const StatusBadge = ({ children, tone = 'slate' }: StatusBadgeProps) => {
  const tones: Record<UiTone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    rose: 'bg-rose-50 text-rose-800',
    sky: 'bg-sky-50 text-sky-800',
  };

  return <span className={classNames('inline-flex items-center rounded-md px-2 py-1 text-xs font-black', tones[tone])}>{children}</span>;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-stone-50 p-6 text-center">
    <div className="font-black text-slate-950">{title}</div>
    <div className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">{description}</div>
    {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
  </div>
);

export const InlineNotice = ({ tone = 'slate', title, children }: InlineNoticeProps) => {
  const tones: Record<UiTone, string> = {
    slate: 'border-slate-200 bg-stone-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };

  return (
    <div className={classNames('rounded-lg border px-3 py-2 text-sm font-bold leading-6', tones[tone])}>
      {title ? <span className="mr-1 font-black">{title}</span> : null}
      {children}
    </div>
  );
};

export const MobileActionBar = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={classNames(
      'fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const ConfirmDialog = ({ title, description, confirmLabel = '确认', cancelLabel = '取消', danger, onConfirm, onCancel }: ConfirmDialogProps) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
    <div className="font-black text-slate-950">{title}</div>
    <div className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</div>
    <div className="mt-4 flex justify-end gap-2">
      <ActionButton variant="secondary" size="sm" onClick={onCancel}>
        {cancelLabel}
      </ActionButton>
      <ActionButton variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
        {confirmLabel}
      </ActionButton>
    </div>
  </div>
);

export const Stat = ({ label, value, tone = 'slate' }: StatProps) => {
  const tones: Record<Tone, string> = {
    slate: 'bg-white border-slate-200 text-slate-950',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
  };

  return (
    <div className={classNames('rounded-lg border p-4', tones[tone])}>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
};

export const Segment = ({ value, options, labels, onChange }: SegmentProps) => (
  <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={classNames(
            'rounded-md px-3 py-2 text-sm font-bold transition',
            selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          {labels?.[option] ?? option}
        </button>
      );
    })}
  </div>
);

export const ModeSwitch = ({ value, onChange }: ModeSwitchProps) => (
  <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
    {Object.values(TRAINING_MODE_META).map((mode) => {
      const selected = value === mode.id;
      return (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={classNames(
            'rounded-md px-2 py-2 text-sm font-bold transition',
            selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          {mode.shortLabel}
        </button>
      );
    })}
  </div>
);

export const InfoPill = ({ label, value }: InfoPillProps) => (
  <div className="rounded-md bg-white p-3 text-sm">
    <div className="text-xs font-black text-slate-500">{label}</div>
    <div className="mt-1 font-bold text-slate-900">{value}</div>
  </div>
);

export const LabelInput = ({ label, value, onChange, type = 'text', placeholder = '' }: LabelInputProps) => (
  <label className="block">
    <span className="mb-1 block text-xs font-black text-slate-500">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-base font-bold outline-none focus:border-emerald-500 md:text-sm"
    />
  </label>
);

export const InfoTooltip = ({ title, body }: { title: string; body: string }) => (
  <details className="group relative inline-block align-middle">
    <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      <Info size={16} aria-label={title} />
    </summary>
    <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-700 shadow-xl">
      <div className="mb-1 font-black text-slate-950">{title}</div>
      {body}
    </div>
  </details>
);

export const WeeklyPrescriptionCard = ({ weeklyPrescription, compact = false }: WeeklyPrescriptionCardProps) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-emerald-700">周剂量</div>
        <h2 className="mt-1 font-black text-slate-950">周训练量预算</h2>
      </div>
      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
        {weeklyPrescription.mode?.shortLabel || '默认'}
      </span>
    </div>
    <div className="space-y-3">
      {weeklyPrescription.muscles.map((item) => {
        const target = Math.max(1, number(item.target));
        const percent = Math.min(100, Math.round((number(item.sets) / target) * 100));
        return (
          <div key={item.muscle}>
            <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
              <span>
                {item.muscle} / {item.frequency}/{item.targetFrequency || 2} 次
              </span>
              <span>
                {item.sets}/{item.target} 组
              </span>
            </div>
            <div className="h-2 rounded-md bg-stone-100">
              <div
                className={classNames('h-2 rounded-md', number(item.sets) >= target ? 'bg-emerald-600' : 'bg-amber-500')}
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            {!compact && (
              <div className="mt-1 text-xs font-medium text-slate-500">
                {item.status || '进行中'} / 剩余 {item.remaining} / 恢复额度 {item.remainingCapacity} / 直接 {item.directSets} / 间接 {item.indirectSets} 组
              </div>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

export const SupportBlockList = ({ title, subtitle, items, tone = 'emerald' }: SupportBlockListProps) => {
  if (!items?.length) return null;
  const toneClass = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <section className={classNames('rounded-lg border p-4', toneClass)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-600">{subtitle}</p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
          {items.reduce((sum, item) => sum + number(item.durationMin), 0)} 分钟
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((block) => (
          <div key={block.id} className="rounded-lg bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-950">{block.name}</h3>
                {'dose' in block && block.dose ? <div className="text-xs font-bold text-slate-500">剂量：{formatSupportDoseAdjustment(block.dose)}</div> : null}
              </div>
              <span className="rounded-md bg-stone-50 px-2 py-1 text-xs font-bold text-slate-500">{block.durationMin} 分钟</span>
            </div>
            <div className="space-y-2">
              {block.exercises.map((exercise) => {
                const targetValue =
                  'distanceM' in exercise && exercise.distanceM
                    ? `${exercise.sets} 组 x ${exercise.distanceM}m`
                    : `${exercise.sets} 组 x ${exercise.repMin || exercise.holdSec || ('timeSec' in exercise ? exercise.timeSec : '')}-${
                        exercise.repMax || exercise.holdSec || ('timeSec' in exercise ? exercise.timeSec : '') || ''
                      }`;
                return (
                  <div key={`${block.id}-${exercise.exerciseId}`} className="rounded-md bg-stone-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-800">{exercise.name || exercise.exerciseId}</span>
                      <span className="text-xs font-bold text-slate-500">{targetValue}</span>
                    </div>
                    {'cue' in exercise && exercise.cue ? <div className="mt-1 text-xs font-bold text-slate-500">{exercise.cue}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
