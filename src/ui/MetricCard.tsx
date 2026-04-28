import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';
import type { UiTone } from './Card';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  tone?: UiTone;
  helper?: ReactNode;
  className?: string;
}

const metricTones: Record<UiTone, string> = {
  slate: 'border-slate-200 bg-white',
  emerald: 'border-emerald-200 bg-emerald-50',
  amber: 'border-amber-200 bg-amber-50',
  rose: 'border-rose-200 bg-rose-50',
  sky: 'border-sky-200 bg-sky-50',
};

export const MetricCard = ({ label, value, tone = 'slate', helper, className }: MetricCardProps) => (
  <div className={classNames('rounded-lg border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', metricTones[tone], className)}>
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</div>
    {helper ? <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div> : null}
  </div>
);
