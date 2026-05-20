import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}

export const ListItem = ({ title, description, meta, action, className, ...props }: ListItemProps) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-3 rounded-lg border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.12)]',
        isDark ? 'border-white/10 bg-white/[0.05] text-white' : 'border-slate-200 bg-white text-slate-950',
        className,
      )}
      data-theme-surface="compact_row"
      data-theme-mode={resolvedTheme}
      {...props}
    >
      <div className="min-w-0">
        <div className={classNames('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{title}</div>
        {description ? <div className={classNames('mt-1 line-clamp-2 text-xs leading-5', isDark ? 'text-white/45' : 'text-slate-600')}>{description}</div> : null}
        {meta ? <div className={classNames('mt-1 text-xs', isDark ? 'text-white/35' : 'text-slate-500')}>{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
};
