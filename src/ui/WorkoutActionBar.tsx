import type { HTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';

export const WorkoutActionBar = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={classNames(
      'fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0b]/96 p-2.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))] text-white shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none',
      'supports-[padding:max(0px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]',
      className
    )}
    data-theme-surface="bottom_sheet"
    data-theme-mode="dark"
    {...props}
  >
    {children}
  </div>
);
