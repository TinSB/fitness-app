import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

export const Toast = ({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' }) => {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return (
    <div role="status" className={classNames('rounded-lg border px-3 py-2 text-sm font-medium leading-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', classes[tone])}>
      {children}
    </div>
  );
};
