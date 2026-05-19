import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { resolveThemeSurface } from '../theme/themeSurfaceModel';

export type SettingsGroupCardProps = {
  children: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
};

const darkChildOverrides =
  '[&_.border-slate-200]:border-white/10 [&_.bg-stone-50]:bg-white/[0.05] [&_.bg-white]:bg-white/[0.06] [&_.bg-emerald-50]:bg-emerald-400/10 [&_.bg-amber-50]:bg-amber-400/10 [&_.bg-red-50]:bg-red-400/10 [&_.bg-rose-50]:bg-rose-400/10 [&_.text-slate-950]:text-white [&_.text-slate-900]:text-white [&_.text-slate-800]:text-white/86 [&_.text-slate-700]:text-white/72 [&_.text-slate-600]:text-white/60 [&_.text-slate-500]:text-white/45 [&_.text-slate-400]:text-white/35 [&_.text-emerald-700]:text-emerald-200 [&_.text-emerald-900]:text-emerald-100 [&_.text-amber-700]:text-amber-200 [&_.text-amber-900]:text-amber-100 [&_.text-red-700]:text-red-200 [&_.text-red-800]:text-red-100 [&_.text-rose-700]:text-rose-200';

export function SettingsGroupCard({ children, className = '', tone = 'dark' }: SettingsGroupCardProps) {
  if (tone === 'dark') {
    return (
      <GlassCard as="section" padding="md" surface="settings_group" themeMode="dark" className={classNames(darkChildOverrides, className)} ariaLabel="设置分组">
        {children}
      </GlassCard>
    );
  }

  const surface = resolveThemeSurface('settings_group', 'light');
  return (
    <section
      className={classNames('rounded-3xl p-4', surface.className, surface.textClassName, className)}
      aria-label="设置分组"
      data-theme-surface="settings_group"
      data-theme-mode="light"
    >
      {children}
    </section>
  );
}
