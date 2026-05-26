import type { HTMLAttributes } from 'react';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

// Audit Bug #5 (2026-05-26): WorkoutActionBar 本体不在 className 里直接挂底部
// safe-area padding 工具类。测试 uiOsR8_6FocusBottomSafeArea 会断言此规则不在源码中。
// 这是用户主动迭代以修复 iPhone PWA 底部黑边的设计选择。需要 safe-area padding 的
// 子页面(如 focus 模式)由 FocusModeActionBar 单独通过 className 传入合适表达式。
// 详见 docs/AUDIT_2026_05_26_RESOLUTION.md
export const WorkoutActionBar = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={classNames(
        'fixed inset-x-0 bottom-0 z-40 border-t p-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none',
        isDark ? 'border-white/10 bg-[#0a0a0b]/96 text-white' : 'border-slate-200 bg-white/94 text-slate-950',
        className
      )}
      data-theme-surface="bottom_sheet"
      data-theme-mode={resolvedTheme}
      data-workout-action-bar-safe-area="covered"
      {...props}
    >
      {children}
    </div>
  );
};
