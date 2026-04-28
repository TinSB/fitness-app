import React from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { RecommendationTrace } from '../engines/recommendationTraceEngine';
import {
  buildRecommendationExplanationViewModel,
  type RecommendationFactorView,
  type RecommendationWarningView,
} from '../presenters/recommendationExplanationPresenter';
import { classNames } from '../engines/engineUtils';

type RecommendationExplanationPanelProps = {
  trace?: RecommendationTrace | null;
  title?: string;
  compact?: boolean;
  maxVisibleFactors?: number;
  showDebugDetails?: boolean;
  warnings?: string[];
  defaultOpen?: boolean;
};

const toneClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  negative: 'border-rose-200 bg-rose-50 text-rose-900',
  neutral: 'border-slate-200 bg-stone-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

const badgeClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-rose-100 text-rose-800',
  neutral: 'bg-white text-slate-600',
  warning: 'bg-amber-100 text-amber-800',
};

const FactorRow = ({ factor, compact = false }: { factor: RecommendationFactorView; compact?: boolean }) => (
  <div className={classNames('rounded-lg border px-3 py-2', toneClass[factor.effectTone])}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{factor.label}</span>
      <span className={classNames('rounded-md px-2 py-0.5 text-[11px] font-semibold', badgeClass[factor.effectTone])}>{factor.effectLabel}</span>
    </div>
    <p className={classNames('mt-1 leading-5', compact ? 'text-xs' : 'text-sm')}>{factor.reason}</p>
  </div>
);

export const RecommendationWarningNotice = ({ warnings }: { warnings: RecommendationWarningView[] }) => {
  if (!warnings.length) return null;
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        可能需要检查
      </summary>
      <div className="mt-2 space-y-2 text-xs leading-5">
        {warnings.map((warning) => (
          <p key={warning.id}>{warning.message}</p>
        ))}
      </div>
    </details>
  );
};

export const RecommendationExplanationPanel = ({
  trace,
  title,
  compact = false,
  maxVisibleFactors,
  showDebugDetails = false,
  warnings = [],
  defaultOpen = false,
}: RecommendationExplanationPanelProps) => {
  const viewModel = React.useMemo(
    () => buildRecommendationExplanationViewModel(trace, { title, warnings }),
    [trace, title, warnings],
  );
  const visibleLimit = maxVisibleFactors ?? (compact ? 2 : 3);
  const primary = viewModel.primaryFactors.length ? viewModel.primaryFactors : viewModel.secondaryFactors.slice(0, 1);
  const visibleFactors = primary.slice(0, visibleLimit);
  const hiddenFactors = [...primary.slice(visibleLimit), ...viewModel.secondaryFactors.filter((item) => !visibleFactors.some((visible) => visible.id === item.id))];

  return (
    <details
      open={defaultOpen}
      className={classNames(
        'rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm',
        compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-sm',
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-950">
        <span>{viewModel.title}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </summary>
      <div className={classNames('mt-3 space-y-3', compact && 'mt-2 space-y-2')}>
        <p className={classNames('leading-6 text-slate-600', compact && 'text-xs leading-5')}>{viewModel.summary}</p>
        <div className="space-y-2">
          {visibleFactors.length ? (
            visibleFactors.map((factor) => <FactorRow key={factor.id} factor={factor} compact={compact} />)
          ) : (
            <div className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2 text-sm text-slate-600">当前推荐主要来自默认模板，继续记录后会更精准。</div>
          )}
        </div>
        {hiddenFactors.length ? (
          <details className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">查看更多原因</summary>
            <div className="mt-2 space-y-2">
              {hiddenFactors.map((factor) => (
                <FactorRow key={factor.id} factor={factor} compact />
              ))}
            </div>
          </details>
        ) : null}
        <RecommendationWarningNotice warnings={viewModel.warnings} />
        {showDebugDetails ? (
          <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs leading-5 text-slate-500">
            已按影响程度、保守信号、训练反馈和默认规则排序。
          </div>
        ) : null}
      </div>
    </details>
  );
};
