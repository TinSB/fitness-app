import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ title, description, action, className }: EmptyStateProps) => (
  <div className={classNames('rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-center md:p-5', className)}>
    <div className="text-base font-semibold text-slate-950">{title}</div>
    <div className="mx-auto mt-1.5 max-w-md text-sm font-normal leading-6 text-slate-500">{description}</div>
    {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
  </div>
);
