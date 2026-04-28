import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}

export const ListItem = ({ title, description, meta, action, className, ...props }: ListItemProps) => (
  <div className={classNames('flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3', className)} {...props}>
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
      {description ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description}</div> : null}
      {meta ? <div className="mt-1 text-xs text-slate-400">{meta}</div> : null}
    </div>
    {action}
  </div>
);
