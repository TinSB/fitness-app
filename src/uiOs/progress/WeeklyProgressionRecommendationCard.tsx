import type { PlanUserFacing, WeeklyProgressionItemView } from '../../engines/trainingDecisionTypes';
import { classNames, number } from '../../engines/engineUtils';

type WeeklyProgressionRecommendationCardProps = {
  recommendation: PlanUserFacing;
  surface?: 'light' | 'dark';
  maxItems?: number;
};

const actionTone = (item: WeeklyProgressionItemView, isDark: boolean) => {
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

export function WeeklyProgressionRecommendationCard({
  recommendation,
  surface = 'light',
  maxItems = 5,
}: WeeklyProgressionRecommendationCardProps) {
  const isDark = surface === 'dark';
  const items = recommendation.weeklyItems.slice(0, maxItems);

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
          const detailLabelTone = isDark ? 'text-white/45' : 'text-slate-500';
          const detailTextTone = isDark ? 'text-white/68' : 'text-slate-600';
          const detailBadgeTone = isDark ? 'border-white/10 bg-white/[0.05] text-white/55' : 'border-slate-200 bg-white text-slate-600';
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
                  {item.actionLabel}
                </span>
                {delta ? (
                  <span className={classNames('rounded-full px-2.5 py-1 text-xs font-semibold', isDark ? 'bg-white/[0.06] text-white/60' : 'bg-white text-slate-600')}>
                    {delta}
                  </span>
                ) : null}
                <span className={classNames('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{item.title}</span>
              </div>
              <p className={classNames('mt-2 text-sm leading-6', isDark ? 'text-white/65' : 'text-slate-600')}>{item.userMessage}</p>
              <p className={classNames('mt-1 text-xs font-semibold', isDark ? 'text-white/42' : 'text-slate-500')}>{item.previewSummary}</p>
              <details className={classNames('group mt-3 border-t pt-3', isDark ? 'border-white/10' : 'border-slate-200')}>
                <summary className={classNames('cursor-pointer select-none text-xs font-semibold leading-5', isDark ? 'text-white/58 hover:text-white/78' : 'text-slate-500 hover:text-slate-700')}>
                  查看原因
                </summary>
                <div className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={classNames('font-semibold', detailLabelTone)}>依据</span>
                      <span className={classNames('rounded-full border px-2 py-0.5 font-semibold', detailBadgeTone)}>{item.confidenceLabel}</span>
                    </div>
                    <p className={classNames('mt-1', detailTextTone)}>{item.reason}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={classNames('font-semibold', detailLabelTone)}>注意</span>
                      <span className={classNames('rounded-full border px-2 py-0.5 font-semibold', detailBadgeTone)}>{item.riskLevelLabel}</span>
                    </div>
                    <p className={classNames('mt-1', detailTextTone)}>{item.risk}</p>
                  </div>
                  <div>
                    <span className={classNames('font-semibold', detailLabelTone)}>下一步</span>
                    <p className={classNames('mt-1', detailTextTone)}>{item.nextStep}</p>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
