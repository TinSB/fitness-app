import React from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type {
  ExplanationUserFacing,
  RecommendationFactorView,
  RecommendationWarningView,
} from '../engines/trainingDecisionTypes';
import { classNames } from '../engines/engineUtils';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

type RecommendationExplanationPanelProps = {
  explanation?: ExplanationUserFacing | null;
  title?: string;
  compact?: boolean;
  maxVisibleFactors?: number;
  showDebugDetails?: boolean;
  defaultOpen?: boolean;
};

const toneClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-50',
  negative: 'border-rose-400/25 bg-rose-400/10 text-rose-50',
  neutral: 'border-white/10 bg-white/[0.05] text-white/68',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-50',
};

const badgeClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'bg-emerald-400/15 text-emerald-100',
  negative: 'bg-rose-400/15 text-rose-100',
  neutral: 'bg-white/[0.06] text-white/58',
  warning: 'bg-amber-400/15 text-amber-100',
};

const lightToneClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  negative: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

const lightBadgeClass: Record<RecommendationFactorView['effectTone'], string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-800',
};

const FactorRow = ({ factor, compact = false, isDark = true }: { factor: RecommendationFactorView; compact?: boolean; isDark?: boolean }) => (
  <div className={classNames('rounded-lg border px-3 py-2', isDark ? toneClass[factor.effectTone] : lightToneClass[factor.effectTone])}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{factor.label}</span>
      <span className={classNames('rounded-md px-2 py-0.5 text-[11px] font-semibold', isDark ? badgeClass[factor.effectTone] : lightBadgeClass[factor.effectTone])}>{factor.effectLabel}</span>
    </div>
    <p className={classNames('mt-1 leading-5', compact ? 'text-xs' : 'text-sm')}>{factor.reason}</p>
  </div>
);

export const RecommendationWarningNotice = ({ warnings }: { warnings: RecommendationWarningView[] }) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  if (!warnings.length) return null;
  return (
    <details className={classNames('rounded-lg border px-3 py-2 text-sm', isDark ? 'border-amber-400/25 bg-amber-400/10 text-amber-50' : 'border-amber-200 bg-amber-50 text-amber-900')} data-theme-surface="warning_surface">
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

const DEFAULT_FALLBACK_SUMMARY = '当前主要依据起始模板和默认处方，系统仍在积累你的训练数据。';

export const RecommendationExplanationPanel = ({
  explanation,
  title,
  compact = false,
  maxVisibleFactors,
  showDebugDetails = false,
  defaultOpen = false,
}: RecommendationExplanationPanelProps) => {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const visibleLimit = maxVisibleFactors ?? (compact ? 2 : 3);
  const primary = explanation?.primaryFactors.length ? explanation.primaryFactors : (explanation?.secondaryFactors || []).slice(0, 1);
  const visibleFactors = primary.slice(0, visibleLimit);
  const hiddenFactors = [
    ...primary.slice(visibleLimit),
    ...(explanation?.secondaryFactors || []).filter((item) => !visibleFactors.some((visible) => visible.id === item.id)),
  ];
  const panelTitle = title || explanation?.title || '为什么这样推荐？';
  const summary = explanation?.summary || DEFAULT_FALLBACK_SUMMARY;
  const warnings = explanation?.warnings || [];

  return (
    <details
      open={defaultOpen}
      className={classNames(
        'rounded-lg border shadow-sm',
        isDark ? 'border-white/10 bg-[#1c1c1e]/86 text-white/70' : 'border-slate-200 bg-white text-slate-700',
        compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-sm',
      )}
      data-theme-surface="elevated_card"
    >
      <summary className={classNames('flex cursor-pointer list-none items-center justify-between gap-3 font-semibold', isDark ? 'text-white' : 'text-slate-950')}>
        <span>{panelTitle}</span>
        <ChevronDown className={classNames('h-4 w-4', isDark ? 'text-white/38' : 'text-slate-400')} />
      </summary>
      <div className={classNames('mt-3 space-y-3', compact && 'mt-2 space-y-2')}>
        <p className={classNames('leading-6', isDark ? 'text-white/58' : 'text-slate-600', compact && 'text-xs leading-5')}>{summary}</p>
        <div className="space-y-2">
          {visibleFactors.length ? (
            visibleFactors.map((factor) => <FactorRow key={factor.id} factor={factor} compact={compact} isDark={isDark} />)
          ) : (
            <div className={classNames('rounded-lg border px-3 py-2 text-sm', isDark ? 'border-white/10 bg-white/[0.05] text-white/58' : 'border-slate-200 bg-slate-50 text-slate-600')}>当前推荐主要来自默认模板，继续记录后会更精准。</div>
          )}
        </div>
        {hiddenFactors.length ? (
          <details className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2" data-theme-surface="compact_row">
            <summary className={classNames('cursor-pointer list-none text-sm font-semibold', isDark ? 'text-white/72' : 'text-slate-700')}>查看更多原因</summary>
            <div className="mt-2 space-y-2">
              {hiddenFactors.map((factor) => (
                <FactorRow key={factor.id} factor={factor} compact isDark={isDark} />
              ))}
            </div>
          </details>
        ) : null}
        <RecommendationWarningNotice warnings={warnings} />
        {showDebugDetails ? (
          <div className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs leading-5 text-white/45" data-theme-surface="compact_row">
            已按影响程度、保守信号、训练反馈和默认规则排序。
          </div>
        ) : null}
      </div>
    </details>
  );
};
