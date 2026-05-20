import type { HTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export const WorkoutActionBar = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={classNames(
        'fixed inset-x-0 bottom-0 z-40 border-t p-2.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.2)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none',
        'supports-[padding:max(0px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]',
        isDark ? 'border-white/10 bg-[#0a0a0b]/96 text-white' : 'border-slate-200 bg-white/94 text-slate-950',
        className
      )}
      data-theme-surface="bottom_sheet"
      data-theme-mode={resolvedTheme}
      {...props}
    >
      {children}
    </div>
  );
};
