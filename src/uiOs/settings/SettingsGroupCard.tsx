import type { ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { resolveThemeSurface } from '../theme/themeSurfaceModel';

export type SettingsGroupCardProps = {
  children: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
};

export function SettingsGroupCard({ children, className = '', tone = 'light' }: SettingsGroupCardProps) {
  if (tone === 'dark') {
    return (
      <GlassCard as="section" padding="md" surface="settings_group" themeMode="dark" className={className} ariaLabel="设置分组">
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
