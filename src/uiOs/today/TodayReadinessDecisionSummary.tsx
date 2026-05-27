import type { TodayUserFacing } from '../../engines/trainingDecisionTypes';
import type { TodayTrainingReadinessDecision } from '../../engines/todayTrainingReadinessDecisionEngine';
import { classNames } from '../../engines/engineUtils';

export const formatTodayReadinessDecisionLabel = (decision: TodayTrainingReadinessDecision) => {
  if (decision.action === 'review_first') return '需要复查';
  if (decision.action === 'no_plan_available') return '缺少安排';
  if (decision.action === 'continue_active_session') return '训练进行中';
  if (decision.action === 'view_completed_session') return '今日已完成';
  if (decision.action === 'postpone_training') return '建议恢复';

  if (decision.decisionKind === 'normal') return '状态正常';
  if (decision.decisionKind === 'conservative') return '建议保守';
  if (decision.decisionKind === 'technique') return '动作优先';
  if (decision.decisionKind === 'deload') return '建议降量';
  return '建议恢复';
};

/**
 * Adapt a TodayUserFacing surface by overlaying the readiness decision label,
 * keeping the structured today payload intact. The decision drives the
 * readiness label only — the rest of the payload (decisionState, heroTitle,
 * heroExplanation, etc.) comes from the TrainingDecision SoT.
 */
export const buildTodayReadinessHeroDecision = (
  surface: TodayUserFacing,
  decision: TodayTrainingReadinessDecision,
): TodayUserFacing => ({
  ...surface,
  readinessLabel: formatTodayReadinessDecisionLabel(decision),
});

const readinessSuggestedActions = (decision: TodayTrainingReadinessDecision): string[] => {
  // Inline the legacy suggestedActions list — small, finite, derived from decisionKind.
  if (decision.action === 'continue_active_session') return [];
  if (decision.action === 'view_completed_session') return [];
  if (decision.action === 'review_first') return ['查看后再决定'];
  if (decision.action === 'no_plan_available') return ['查看后再决定'];
  if (decision.action === 'postpone_training') return ['查看后再决定'];
  if (decision.decisionKind === 'deload') return ['不主动加量', '保留主训练', '减少辅助'];
  if (decision.decisionKind === 'technique') return ['不主动加量', '保留主训练'];
  if (decision.decisionKind === 'conservative') return ['不主动加量', '保留主训练'];
  return [];
};

export const getTodayReadinessSummaryItems = (decision: TodayTrainingReadinessDecision) =>
  [...new Set(readinessSuggestedActions(decision).filter(Boolean))].slice(0, 3);

const shouldShowPassivePreview = (decision: TodayTrainingReadinessDecision) =>
  decision.decisionKind !== 'normal' && decision.action !== 'continue_active_session' && decision.action !== 'view_completed_session';

export function TodayReadinessDecisionSummary({
  decision,
  className = '',
}: {
  decision: TodayTrainingReadinessDecision;
  className?: string;
}) {
  const items = getTodayReadinessSummaryItems(decision);
  const previewSummary = shouldShowPassivePreview(decision) ? '只影响本次，不改变计划' : undefined;

  if (!items.length && !previewSummary) return null;

  return (
    <div
      className={classNames('rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs leading-5 text-white/62', className)}
      data-today-readiness-decision-summary="compact"
      aria-label="今日训练提示"
    >
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 font-semibold text-white/72">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {previewSummary ? <div className={items.length ? 'mt-2 text-white/50' : 'text-white/50'}>{previewSummary}</div> : null}
    </div>
  );
}
