import React from 'react';
import type { TrainingSession } from '../../models/training-model';
import { classNames } from '../../engines/engineUtils';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';

export type RecentTrainingTimelineProps = {
  sessions: TrainingSession[];
  getTitle: (session: TrainingSession) => React.ReactNode;
  getDescription: (session: TrainingSession) => string;
  getMeta?: (session: TrainingSession) => string;
  onOpenSession?: (session: TrainingSession) => void;
  className?: string;
};

export function RecentTrainingTimeline({
  sessions,
  getTitle,
  getDescription,
  getMeta,
  onOpenSession,
  className = '',
}: RecentTrainingTimelineProps) {
  return (
    <GlassCard as="section" padding="lg" className={classNames('text-white', className)} ariaLabel="近期训练记录">
      <div className="mb-4">
        <p className="text-sm font-semibold text-white/55">近期训练</p>
        <h3 className="text-xl font-bold tracking-tight">列表保留，但不抢占日历</h3>
      </div>
      {!sessions.length ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-white/50">
          暂无训练记录。完成一次训练后，这里会显示最近记录。
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <article key={session.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{getTitle(session)}</div>
                  <div className="mt-1 text-xs leading-5 text-white/45">{getDescription(session)}</div>
                  {getMeta ? <div className="mt-1 text-xs text-white/35">{getMeta(session)}</div> : null}
                </div>
                {onOpenSession ? (
                  <ActionButton size="sm" variant="secondary" onClick={() => onOpenSession(session)}>
                    查看详情
                  </ActionButton>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
