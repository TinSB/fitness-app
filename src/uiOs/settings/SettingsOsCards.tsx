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
      className={classNames('rounded-[28px] bg-[#0a0a0b] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]', className)}
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
    <div className={classNames('rounded-2xl border border-slate-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-700', className)}>
      {children}
    </div>
  );
}
