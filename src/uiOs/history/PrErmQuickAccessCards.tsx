import React from 'react';
import { Medal } from 'lucide-react';
import { classNames } from '../../engines/engineUtils';
import type { HistoryPrQuickAccessItem } from '../../engines/historyCalendarSummary';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

export type PrErmQuickAccessCardsProps = {
  items: HistoryPrQuickAccessItem[];
  onSelectExercise?: (exerciseId: string) => void;
  className?: string;
};

export function PrErmQuickAccessCards({ items, onSelectExercise, className = '' }: PrErmQuickAccessCardsProps) {
  return (
    <GlassCard as="section" padding="lg" className={classNames('text-white', className)} ariaLabel="PR e1RM 快速入口">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-200">PR / e1RM 快速入口</p>
          <h3 className="text-xl font-bold tracking-tight">主要动作一眼回看</h3>
        </div>
        <Medal className="h-5 w-5 text-violet-300" aria-hidden="true" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.exerciseId} className="rounded-2xl border border-white/8 bg-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{item.label}</div>
                <div className="mt-2 text-sm text-white/55">{item.prLabel}</div>
                <div className="mt-1 text-sm text-white/45">{item.e1rmLabel}</div>
              </div>
              <StatusBadge state={item.hasData ? 'info' : 'disabled'}>{item.hasData ? '已有数据' : '待记录'}</StatusBadge>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-white/35">{item.date || '完成正式训练后显示'}</span>
              {onSelectExercise ? (
                <ActionButton size="sm" variant="ghost" onClick={() => onSelectExercise(item.exerciseId)}>
                  查看
                </ActionButton>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
