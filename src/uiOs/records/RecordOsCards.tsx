import React from 'react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function RecordOsOverview({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard
      as="section"
      padding="lg"
      surface="record_detail_surface"
      className={classNames('rounded-[28px] shadow-[0_24px_80px_rgba(15,23,42,0.12)]', className)}
      ariaLabel="历史与进步总览"
      highlight
    >
      {children}
    </GlassCard>
  );
}

export function RecordTimelineCard({ children, className = '' }: SurfaceProps) {
  return (
    <article className={classNames('rounded-3xl border p-3 shadow-sm', className)} aria-label="训练记录卡片" data-theme-surface="compact_row">
      {children}
    </article>
  );
}

export function ProgressInsightCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-50', className)} aria-label="进步解释" data-theme-surface="health_card">
      {children}
    </section>
  );
}

export function DataHealthIssueCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-amber-400/25 bg-amber-400/10 p-4 text-amber-50', className)} aria-label="数据健康问题" data-theme-surface="warning_surface">
      {children}
    </section>
  );
}
