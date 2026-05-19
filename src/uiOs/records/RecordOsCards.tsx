import React from 'react';
import { classNames } from '../../engines/engineUtils';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function RecordOsOverview({ children, className = '' }: SurfaceProps) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-white/10 bg-[#0a0a0b] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]',
        className,
      )}
      aria-label="历史与进步总览"
    >
      {children}
    </section>
  );
}

export function RecordTimelineCard({ children, className = '' }: SurfaceProps) {
  return (
    <article className={classNames('rounded-3xl border border-slate-200 bg-white p-3 shadow-sm', className)} aria-label="训练记录卡片">
      {children}
    </article>
  );
}

export function ProgressInsightCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950', className)} aria-label="进步解释">
      {children}
    </section>
  );
}

export function DataHealthIssueCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950', className)} aria-label="数据健康问题">
      {children}
    </section>
  );
}
