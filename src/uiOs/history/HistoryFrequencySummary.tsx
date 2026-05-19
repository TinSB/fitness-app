import React from 'react';
import { Activity, CalendarDays, Flame, Sigma } from 'lucide-react';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge } from '../primitives/StatusBadge';

export type HistoryFrequencySummaryProps = {
  thisWeekTrainingDays: number;
  thisMonthTrainingDays: number;
  recentFourWeekAverage: number;
  currentStreak?: number;
  dataHealthHint?: string;
  className?: string;
};

const metricItems = ({
  thisWeekTrainingDays,
  thisMonthTrainingDays,
  recentFourWeekAverage,
  currentStreak,
}: HistoryFrequencySummaryProps) => [
  {
    label: '本周训练',
    value: `${thisWeekTrainingDays} 天`,
    helper: '按有正式训练记录的日期统计',
    icon: CalendarDays,
  },
  {
    label: '本月训练',
    value: `${thisMonthTrainingDays} 天`,
    helper: '日历频率，不改变历史数据',
    icon: Sigma,
  },
  {
    label: '近 4 周平均',
    value: `${recentFourWeekAverage.toFixed(1)} 天/周`,
    helper: '用于观察节奏，不参与算法',
    icon: Activity,
  },
  {
    label: '连续性',
    value: currentStreak && currentStreak > 0 ? `${currentStreak} 天` : '待积累',
    helper: '只根据已有记录回看',
    icon: Flame,
  },
];

export function HistoryFrequencySummary(props: HistoryFrequencySummaryProps) {
  const { dataHealthHint, className = '' } = props;

  return (
    <GlassCard
      as="section"
      padding="lg"
      className={classNames('rounded-[28px] bg-[#0b0c0d] text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]', className)}
      ariaLabel="训练频率摘要"
      highlight
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-200" data-theme-text="sectionTitle" data-heading-contrast="high">训练频率</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white" data-theme-text="sectionTitle" data-heading-contrast="high">先看哪些天练了，哪些天没练</h2>
        </div>
        {dataHealthHint ? <StatusBadge state={dataHealthHint.includes('没有') ? 'safe' : 'warning'}>{dataHealthHint}</StatusBadge> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricItems(props).map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.06] p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-white/55">
                <span className="text-xs font-semibold">{item.label}</span>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="text-2xl font-bold tabular-nums">{item.value}</div>
              <p className="mt-2 text-xs leading-5 text-white/45">{item.helper}</p>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
