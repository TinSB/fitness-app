import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

interface DashboardLayoutProps extends HTMLAttributes<HTMLDivElement> {
  main: ReactNode;
  side?: ReactNode;
}

export const DashboardLayout = ({ main, side, className, ...props }: DashboardLayoutProps) => (
  <div className={classNames('grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.85fr)]', className)} {...props}>
    <div className="min-w-0 space-y-4">{main}</div>
    {side ? <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">{side}</aside> : null}
  </div>
);
