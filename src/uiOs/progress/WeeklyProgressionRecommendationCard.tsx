import type {
  WeeklyProgressionItem,
  WeeklyProgressionRecommendation,
} from '../../engines/weeklyProgressionRecommendationEngine';
import { classNames, number } from '../../engines/engineUtils';

type WeeklyProgressionRecommendationCardProps = {
  recommendation: WeeklyProgressionRecommendation;
  surface?: 'light' | 'dark';
  maxItems?: number;
};

const actionLabel = (item: WeeklyProgressionItem) => {
  if (item.recommendationKind === 'progress') return '小幅推进';
  if (item.recommendationKind === 'maintain') return '维持';
  if (item.recommendationKind === 'deload' || item.actionType === 'reduce_volume') return '减少';
  if (item.recommendationKind === 'review_exercise' || item.recommendationKind === 'review_volume' || item.recommendationKind === 'technique_focus' || item.recommendationKind === 'pain_review') {
    return '复查动作';
  }
  if (item.recommendationKind === 'insufficient_data') return '继续记录';
  return '暂缓';
};

const actionTone = (item: WeeklyProgressionItem, isDark: boolean) => {
  if (item.riskLevel === 'high') return isDark ? 'border-rose-300/20 bg-rose-300/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-800';
  if (item.recommendationKind === 'progress') return isDark ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (item.recommendationKind === 'maintain') return isDark ? 'border-sky-300/20 bg-sky-300/10 text-sky-100' : 'border-sky-200 bg-sky-50 text-sky-800';
  if (item.recommendationKind === 'insufficient_data') return isDark ? 'border-white/10 bg-white/[0.06] text-white/60' : 'border-slate-200 bg-slate-50 text-slate-600';
  return isDark ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800';
};

const setsDeltaLabel = (setsDelta?: number) => {
  const delta = number(setsDelta);
  if (!delta) return '';
  return `${delta > 0 ? '+' : ''}${delta} 组`;
};

const previewSummary = (item: WeeklyProgressionItem) => item.guardedRecommendation?.preview.summary || '不改变计划';

export function WeeklyProgressionRecommendationCard({
  recommendation,
  surface = 'light',
  maxItems = 5,
}: WeeklyProgressionRecommendationCardProps) {
  const isDark = surface === 'dark';
  const items = recommendation.items.slice(0, maxItems);

  return (
    <section
      aria-label="下周建议"
      data-weekly-progression-recommendation="display"
      className={classNames(
        'rounded-2xl border p-4',
        isDark ? 'border-white/8 bg-white/[0.06] text-white' : 'border-slate-200 bg-white text-slate-950',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={classNames('text-sm font-semibold', isDark ? 'text-emerald-200' : 'text-emerald-700')}>下周建议</p>
          <h2 className={classNames('mt-1 text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
            {recommendation.title}
          </h2>
        </div>
        <span className={classNames('rounded-full border px-3 py-1 text-xs font-semibold', isDark ? 'border-white/10 bg-white/[0.05] text-white/55' : 'border-slate-200 bg-stone-50 text-slate-600')}>
          不改变计划
        </span>
      </div>
      <p className={classNames('mt-3 text-sm leading-6', isDark ? 'text-white/65' : 'text-slate-600')}>{recommendation.summary}</p>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const delta = setsDeltaLabel(item.setsDelta);
          return (
            <article
              key={item.id}
              className={classNames(
                'rounded-xl border px-3 py-3',
                isDark ? 'border-white/10 bg-white/[0.05]' : 'border-slate-200 bg-stone-50',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', actionTone(item, isDark))}>
                  {actionLabel(item)}
                </span>
                {delta ? (
                  <span className={classNames('rounded-full px-2.5 py-1 text-xs font-semibold', isDark ? 'bg-white/[0.06] text-white/60' : 'bg-white text-slate-600')}>
                    {delta}
                  </span>
                ) : null}
                <span className={classNames('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{item.title}</span>
              </div>
              <p className={classNames('mt-2 text-sm leading-6', isDark ? 'text-white/65' : 'text-slate-600')}>{item.userMessage}</p>
              <p className={classNames('mt-1 text-xs font-semibold', isDark ? 'text-white/42' : 'text-slate-500')}>{previewSummary(item)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
