import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}

export const ListItem = ({ title, description, meta, action, className, ...props }: ListItemProps) => (
  <div
    className={classNames('flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]', className)}
    data-theme-surface="compact_row"
    data-theme-mode="dark"
    {...props}
  >
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-white">{title}</div>
      {description ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{description}</div> : null}
      {meta ? <div className="mt-1 text-xs text-white/35">{meta}</div> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);
