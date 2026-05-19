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
  slate: '!border-white/10 !bg-[#1c1c1e]/86',
  emerald: '!border-emerald-400/25 !bg-emerald-400/10',
  amber: '!border-amber-400/25 !bg-amber-400/10',
  rose: '!border-rose-400/25 !bg-rose-400/10',
  sky: '!border-sky-400/25 !bg-sky-400/10',
};

export const MetricCard = ({ label, value, tone = 'slate', helper, className }: MetricCardProps) => (
  <div className={classNames('rounded-lg border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', metricTones[tone], className)} data-theme-surface="compact_row">
    <div className="text-xs font-semibold text-white/45">{label}</div>
    <div className="mt-1 truncate text-2xl font-bold tracking-tight text-white">{value}</div>
    {helper ? <div className="mt-1 text-xs leading-5 text-white/45">{helper}</div> : null}
  </div>
);
