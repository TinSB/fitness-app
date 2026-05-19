import type { ReactNode } from 'react';
import { GlassCard } from '../primitives/GlassCard';

export type SettingsGroupCardProps = {
  children: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
};

export function SettingsGroupCard({ children, className = '', tone = 'light' }: SettingsGroupCardProps) {
  if (tone === 'dark') {
    return (
      <GlassCard as="section" padding="md" className={className} ariaLabel="设置分组">
        {children}
      </GlassCard>
    );
  }

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-xl ${className}`} aria-label="设置分组">
      {children}
    </section>
  );
}
