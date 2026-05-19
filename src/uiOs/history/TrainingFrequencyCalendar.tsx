import React from 'react';
import { classNames } from '../../engines/engineUtils';
import type { HistoryCalendarDay } from '../../engines/historyCalendarSummary';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';

export type TrainingFrequencyCalendarProps = {
  month: string;
  days: HistoryCalendarDay[];
  canGoPreviousMonth?: boolean;
  canGoNextMonth?: boolean;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
  onSelectDate?: (date: string) => void;
  className?: string;
};

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

const leadingBlankCount = (firstDate?: string) => {
  if (!firstDate) return 0;
  const date = new Date(`${firstDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const markerClass = (day: HistoryCalendarDay) => {
  if (day.isSelected) return 'border-emerald-300 bg-emerald-400 text-black shadow-[0_12px_30px_rgba(52,199,89,0.28)]';
  if (day.hasTraining) return 'border-emerald-400/35 bg-emerald-400/15 text-emerald-100';
  if (day.isToday) return 'border-blue-400/50 bg-blue-400/12 text-blue-100';
  return 'border-white/8 bg-white/[0.035] text-white/42';
};

export function TrainingFrequencyCalendar({
  month,
  days,
  canGoPreviousMonth = true,
  canGoNextMonth = true,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  className = '',
}: TrainingFrequencyCalendarProps) {
  return (
    <GlassCard as="section" padding="lg" className={classNames('text-white', className)} ariaLabel="训练频率日历">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/55">训练日历</p>
          <h3 className="text-xl font-bold tracking-tight">{month}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton size="sm" variant="secondary" onClick={onPreviousMonth} disabled={!canGoPreviousMonth} aria-label="上一月">
            上一月
          </ActionButton>
          <ActionButton size="sm" variant="secondary" onClick={onNextMonth} disabled={!canGoNextMonth} aria-label="下一月">
            下一月
          </ActionButton>
          <ActionButton size="sm" variant="ghost" onClick={onToday} aria-label="回到今天">
            今天
          </ActionButton>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-white/45">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />训练日</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" />未训练</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />今天</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" />PR/e1RM</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-white/45">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1">{label}</div>
        ))}
        {Array.from({ length: leadingBlankCount(days[0]?.date) }).map((_, index) => (
          <div key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate?.(day.date)}
            className={classNames('min-h-14 rounded-2xl border px-1.5 py-2 text-xs font-semibold transition active:scale-[0.98]', markerClass(day))}
            aria-label={`${day.date} ${day.hasTraining ? '已训练' : '未训练'}`}
          >
            <div className="tabular-nums">{day.displayLabel}</div>
            <div className="mt-1 flex justify-center gap-1">
              {day.hasTraining ? <span aria-label="训练记录" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
              {day.hasPr || day.hasE1rmChange ? <span aria-label="PR/e1RM 记录" className="h-1.5 w-1.5 rounded-full bg-violet-300" /> : null}
              {day.hasIssueHint ? <span aria-label="建议检查" className="h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
            </div>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
