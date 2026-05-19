import React from 'react';
import { classNames } from '../../engines/engineUtils';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function SettingsOsHero({ children, className = '' }: SurfaceProps) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-white/10 bg-[#0a0a0b] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]',
        className,
      )}
      aria-label="设置安全总览"
    >
      {children}
    </section>
  );
}

export function SettingsOsGroup({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {children}
    </section>
  );
}

export function SettingsOsMiniCard({ children, className = '' }: SurfaceProps) {
  return (
    <div className={classNames('rounded-2xl border border-slate-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-700', className)}>
      {children}
    </div>
  );
}
