import type { HTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';

export const WorkoutActionBar = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={classNames(
      'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(15,23,42,0.12)] md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none',
      'supports-[padding:max(0px)]:pb-[max(0.875rem,env(safe-area-inset-bottom))]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
