import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { HistorySelectedDaySummary } from '../../engines/historyCalendarSummary';
import { classNames } from '../../engines/engineUtils';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

export type HistoryDaySessionItem = {
  id: string;
  title: React.ReactNode;
  description: string;
  meta?: string;
};

export type HistoryDaySummaryCardProps = {
  summary: HistorySelectedDaySummary;
  sessions?: HistoryDaySessionItem[];
  onOpenSession?: (sessionId: string) => void;
  className?: string;
};

export function HistoryDaySummaryCard({ summary, sessions = [], onOpenSession, className = '' }: HistoryDaySummaryCardProps) {
  return (
    <GlassCard as="section" padding="lg" className={classNames('text-white', className)} ariaLabel="选中日期摘要">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/55">选中日期</p>
          <h3 className="text-xl font-bold tracking-tight">{summary.date}</h3>
        </div>
        <CalendarDays className="h-5 w-5 text-emerald-300" aria-hidden="true" />
      </div>
      {!summary.trained ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
          <div className="text-base font-semibold">这天没有训练记录</div>
          <p className="mt-2 text-sm leading-6 text-white/50">{summary.emptyCopy || '休息日也属于计划的一部分。'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge state="safe">已训练</StatusBadge>
              {summary.issueHint ? <StatusBadge state="warning">{summary.issueHint}</StatusBadge> : null}
            </div>
            <p className="mt-3 text-lg font-bold">{summary.sessionTitles.join(' / ')}</p>
            <p className="mt-1 text-sm text-white/55">{summary.mainLiftSummary || `${summary.totalSets || 0} 组`}</p>
            {summary.mainExercises.length ? (
              <p className="mt-2 text-sm leading-6 text-white/50">主要动作：{summary.mainExercises.join('、')}</p>
            ) : null}
          </div>
          {sessions.map((session) => (
            <div key={session.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{session.title}</div>
                  <div className="mt-1 text-xs leading-5 text-white/45">{session.description}</div>
                  {session.meta ? <div className="mt-1 text-xs text-white/35">{session.meta}</div> : null}
                </div>
                {onOpenSession ? (
                  <ActionButton size="sm" variant="secondary" onClick={() => onOpenSession(session.id)}>
                    详情
                  </ActionButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
