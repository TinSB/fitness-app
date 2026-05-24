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

const hasAnySignal = (item: WeeklyProgressionItem, signals: readonly string[]) => {
  const values = [...item.reasonCodes, ...item.riskFlags, ...item.blockedReasons];
  return signals.some((signal) => values.includes(signal));
};

const formatWeeklyReason = (item: WeeklyProgressionItem) => {
  if (hasAnySignal(item, ['pain_pattern', 'pain_risk'])) return '有不适记录，先复查。';
  if (hasAnySignal(item, ['low_confidence'])) return '可用记录还不够稳定。';
  if (hasAnySignal(item, ['volume_decrease'])) return '近期压力偏高，先控制训练量。';
  if (hasAnySignal(item, ['volume_increase'])) return '近期完成度支持小幅推进。';
  if (hasAnySignal(item, ['volume_maintain', 'effective_set_summary'])) return '当前训练量接近目标。';
  if (hasAnySignal(item, ['volume_hold'])) return '当前信号不够一致，先继续观察。';
  if (hasAnySignal(item, ['plateau'])) return '近期进展停滞，先复查动作历史。';
  if (hasAnySignal(item, ['possible_plateau'])) return '近期进展放缓，继续观察。';
  if (hasAnySignal(item, ['load_too_aggressive', 'load_feedback_risk'])) return '重量推进偏快，先稳住。';
  if (hasAnySignal(item, ['technique_limited', 'low_session_quality'])) return '动作质量限制推进。';
  if (hasAnySignal(item, ['fatigue_limited'])) return '疲劳信号较明显。';
  if (hasAnySignal(item, ['volume_limited'])) return '有效训练量可能不足。';
  if (hasAnySignal(item, ['volume_increase_blocked'])) return '当前信号不够一致，先继续观察。';
  if (hasAnySignal(item, ['insufficient_data'])) return '继续记录后再判断。';
  return '依据来自近期训练记录。';
};

const formatWeeklyRisk = (item: WeeklyProgressionItem) => {
  if (hasAnySignal(item, ['medical_risk'])) return '如不适持续，请先停止相关动作。';
  if (hasAnySignal(item, ['pain', 'pain_risk'])) return '有不适记录，暂不建议直接推进。';
  if (hasAnySignal(item, ['technique', 'technique_limited', 'low_session_quality'])) return '动作质量需要优先稳定。';
  if (hasAnySignal(item, ['fatigue', 'fatigue_limited'])) return '疲劳较高，先保守处理。';
  if (hasAnySignal(item, ['load_too_aggressive', 'load_feedback_risk'])) return '重量推进不要过快。';
  if (item.riskLevel === 'high') return '风险较高，先复查。';
  if (item.riskLevel === 'medium') return '风险中等，查看后再决定。';
  return '风险较低，仍需观察反馈。';
};

const formatWeeklyConfidence = (item: WeeklyProgressionItem) => {
  if (item.confidence === 'high') return '置信度高';
  if (item.confidence === 'medium') return '置信度中等';
  return '置信度偏低';
};

const formatWeeklyRiskLevel = (item: WeeklyProgressionItem) => {
  if (item.riskLevel === 'high') return '风险较高';
  if (item.riskLevel === 'medium') return '风险中等';
  return '风险较低';
};

const nextStepFallback = (item: WeeklyProgressionItem) => {
  if (item.recommendationKind === 'progress') return '查看后再决定。';
  if (item.recommendationKind === 'maintain') return '维持当前节奏。';
  if (item.recommendationKind === 'deload') return '先控制训练压力。';
  if (item.recommendationKind === 'review_exercise') return '先复查动作历史。';
  if (item.recommendationKind === 'technique_focus') return '先稳住动作。';
  if (item.recommendationKind === 'pain_review') return '有不适，先复查。';
  if (item.recommendationKind === 'insufficient_data') return '继续记录训练。';
  return '继续记录后再判断。';
};

const passiveNextStepCopy = new Set([
  '查看后再决定',
  '只生成候选，不改变计划',
  '不改变计划',
  '继续记录后再判断',
  '下周维持当前节奏',
  '维持当前节奏',
  '先复查',
  '继续观察',
  '不急于加重',
  '先稳住动作',
  '先控制疲劳',
  '先复查训练量',
  '继续记录训练',
  '先控制训练压力',
  '先复查动作历史',
  '有不适，先复查',
]);

const trimSentenceEnd = (value: string) => value.replace(/[。！？]+$/u, '').trim();

const completeSentence = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[。！？]$/u.test(trimmed) ? trimmed : `${trimmed}。`;
};

const cleanPassiveNextStep = (value: unknown) => {
  const normalized = trimSentenceEnd(String(value ?? ''));
  if (!passiveNextStepCopy.has(normalized)) return '';
  return completeSentence(normalized);
};

const uniqueCopy = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

const formatWeeklyNextStep = (item: WeeklyProgressionItem) => {
  const actions = uniqueCopy([
    ...item.suggestedActions.map(cleanPassiveNextStep),
    cleanPassiveNextStep(item.guardedRecommendation?.preview.summary),
    cleanPassiveNextStep(item.guardedRecommendation?.preview.after),
  ]).slice(0, 2);

  if (actions.length) return actions.join(' ');
  return nextStepFallback(item);
};

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
              <details className={classNames('group mt-3 border-t pt-3', isDark ? 'border-white/10' : 'border-slate-200')}>
                <summary className={classNames('cursor-pointer select-none text-xs font-semibold leading-5', isDark ? 'text-white/58 hover:text-white/78' : 'text-slate-500 hover:text-slate-700')}>
                  查看原因
                </summary>
                <div className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={classNames('font-semibold', detailLabelTone)}>依据</span>
                      <span className={classNames('rounded-full border px-2 py-0.5 font-semibold', detailBadgeTone)}>{formatWeeklyConfidence(item)}</span>
                    </div>
                    <p className={classNames('mt-1', detailTextTone)}>{formatWeeklyReason(item)}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={classNames('font-semibold', detailLabelTone)}>注意</span>
                      <span className={classNames('rounded-full border px-2 py-0.5 font-semibold', detailBadgeTone)}>{formatWeeklyRiskLevel(item)}</span>
                    </div>
                    <p className={classNames('mt-1', detailTextTone)}>{formatWeeklyRisk(item)}</p>
                  </div>
                  <div>
                    <span className={classNames('font-semibold', detailLabelTone)}>下一步</span>
                    <p className={classNames('mt-1', detailTextTone)}>{formatWeeklyNextStep(item)}</p>
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
