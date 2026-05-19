import React from 'react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { SettingsGroupCard } from './SettingsGroupCard';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function SettingsOsHero({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard
      as="section"
      padding="lg"
      className={classNames('rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.16)]', className)}
      ariaLabel="设置安全总览"
      highlight
    >
      {children}
    </GlassCard>
  );
}

export function SettingsOsGroup({ children, className = '' }: SurfaceProps) {
  return (
    <SettingsGroupCard className={className}>
      {children}
    </SettingsGroupCard>
  );
}

export function SettingsOsMiniCard({ children, className = '' }: SurfaceProps) {
  return (
    <div className={classNames('rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-2 text-sm leading-6 text-white/66', className)} data-theme-surface="compact_row">
      {children}
    </div>
  );
}
