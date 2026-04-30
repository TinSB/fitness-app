import type { CoachAction, CoachActionPriority, CoachActionType } from '../engines/coachActionEngine';
import { draftMatchesCoachAction } from '../engines/coachActionDismissEngine';
import { buildProgramAdjustmentDraftFingerprint, dedupeProgramAdjustmentDraftsByFingerprint } from '../engines/coachActionIdentityEngine';
import type { MuscleVolumeAdaptation, VolumeAdaptationReport } from '../engines/volumeAdaptationEngine';
import { formatExerciseName, formatMuscleName, formatRiskLevel, formatTemplateName } from '../i18n/formatters';
import type { ProgramAdjustmentDraft } from '../models/training-model';
import type { ActionButtonVariant } from '../ui/ActionButton';

export type AggregatedPlanAdviceCategory = 'volume' | 'plateau' | 'recovery' | 'data_health' | 'draft' | 'template' | 'other';

export type AggregatedPlanAdviceStatus = 'suggestion' | 'draft_ready' | 'needs_confirmation' | 'applied' | 'dismissed';

export type AggregatedPlanAdviceAffectedItem = {
  type: 'muscle' | 'exercise' | 'template' | 'session';
  id: string;
  label: string;
  summary: string;
};

export type AggregatedPlanAdviceAction = {
  label: string;
  actionType: CoachActionType | string;
  variant: ActionButtonVariant;
  coachAction?: CoachAction;
};

export type AggregatedPlanAdvice = {
  id: string;
  category: AggregatedPlanAdviceCategory;
  title: string;
  summary: string;
  priority: CoachActionPriority;
  status: AggregatedPlanAdviceStatus;
  affectedItems: AggregatedPlanAdviceAffectedItem[];
  primaryAction?: AggregatedPlanAdviceAction;
  secondaryActions?: AggregatedPlanAdviceAction[];
  sourceActionIds: string[];
};

const priorityRank: Record<CoachActionPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const rawTokenPattern =
  /\b(undefined|null|increase|decrease|maintain|hold|pending|applied|dismissed|expired|failed|urgent|high|medium|low|create_plan_adjustment_preview|review_volume|review_exercise|volumeAdaptation|plateau|dataHealth)\b/gi;

const cleanText = (value: unknown, fallback: string) => {
  const text = String(value ?? '')
    .replace(rawTokenPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
};

const strongestPriority = (priorities: CoachActionPriority[]): CoachActionPriority =>
  priorities.reduce<CoachActionPriority>((current, next) => (priorityRank[next] > priorityRank[current] ? next : current), 'low');

const draftStatus = (draft: ProgramAdjustmentDraft): AggregatedPlanAdviceStatus => {
  if (draft.status === 'applied') return 'applied';
  if (draft.status === 'dismissed') return 'dismissed';
  if (draft.status === 'rolled_back') return 'dismissed';
  return 'draft_ready';
};

const draftActionIds = (drafts: ProgramAdjustmentDraft[]) =>
  new Set(
    drafts.flatMap((draft) => [
      draft.sourceCoachActionId,
      draft.sourceRecommendationId,
      draft.sourceFingerprint,
      ...(draft.selectedRecommendationIds || []),
    ]).filter(Boolean) as string[],
  );

const draftFingerprints = (drafts: ProgramAdjustmentDraft[]) =>
  new Set(drafts.map((draft) => buildProgramAdjustmentDraftFingerprint(draft)).filter(Boolean));

const draftTargets = (drafts: ProgramAdjustmentDraft[]) =>
  new Set(
    drafts.flatMap((draft) =>
      (draft.changes || []).flatMap((change) => [
        change.muscleId ? `muscle:${change.muscleId}` : undefined,
        change.exerciseId ? `exercise:${change.exerciseId}` : undefined,
        change.dayTemplateId ? `template:${change.dayTemplateId}` : undefined,
      ]),
    ).filter(Boolean) as string[],
  );

const actionTargetKey = (action: CoachAction) => (action.targetId && action.targetType ? `${action.targetType}:${action.targetId}` : '');

const isRealDraft = (draft: ProgramAdjustmentDraft) => draft.status !== 'recommendation';

const shouldExcludeActionForDraft = (action: CoachAction, knownDraftActionIds: Set<string>, knownDraftTargets: Set<string>) => {
  if (knownDraftActionIds.has(action.id)) return true;
  if (action.sourceFingerprint && knownDraftActionIds.has(action.sourceFingerprint)) return true;
  const key = actionTargetKey(action);
  return Boolean(key && knownDraftTargets.has(key));
};

const dedupeActions = (actions: CoachAction[]) => {
  const byKey = new Map<string, CoachAction>();
  actions.forEach((action) => {
    const key = `${action.source}:${action.actionType}:${action.targetType || 'none'}:${action.targetId || action.id}`;
    const existing = byKey.get(key);
    if (!existing || priorityRank[action.priority] > priorityRank[existing.priority]) {
      byKey.set(key, action);
    }
  });
  return [...byKey.values()];
};

const planCategoryForAction = (action: CoachAction): AggregatedPlanAdviceCategory => {
  if (action.source === 'volumeAdaptation' || action.actionType === 'review_volume') return 'volume';
  if (action.source === 'plateau' || action.actionType === 'review_exercise') return 'plateau';
  if (action.source === 'recovery') return 'recovery';
  if (action.source === 'dataHealth') return 'data_health';
  if (action.targetType === 'template') return 'template';
  return 'other';
};

const formatAffectedLabel = (type: AggregatedPlanAdviceAffectedItem['type'], id?: string) => {
  if (type === 'muscle') return formatMuscleName(id || '');
  if (type === 'exercise') return formatExerciseName(id || '');
  if (type === 'template') return formatTemplateName(id || '');
  return '相关训练';
};

const affectedFromAction = (action: CoachAction): AggregatedPlanAdviceAffectedItem => {
  const type = action.targetType === 'muscle' || action.targetType === 'exercise' || action.targetType === 'template' || action.targetType === 'session'
    ? action.targetType
    : 'template';
  return {
    type,
    id: action.targetId || action.id,
    label: formatAffectedLabel(type, action.targetId),
    summary: cleanText(action.reason || action.description, '查看详情后再决定是否处理。'),
  };
};

const volumeDecisionSummary = (item: MuscleVolumeAdaptation) => {
  if (item.decision === 'increase') return `建议增加 ${item.setsDelta || 1} 组`;
  if (item.decision === 'decrease') return `建议减少 ${Math.abs(item.setsDelta || 1)} 组`;
  if (item.decision === 'hold') return '建议暂缓调整';
  return '建议维持观察';
};

const uniqueAffectedItems = (items: AggregatedPlanAdviceAffectedItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const volumeItems = (volumeAdaptation?: VolumeAdaptationReport | null, knownDraftTargets?: Set<string>) =>
  (volumeAdaptation?.muscles || [])
    .filter((item) => item.decision === 'increase' || item.decision === 'decrease' || item.decision === 'hold')
    .filter((item) => !knownDraftTargets?.has(`muscle:${item.muscleId}`));

const buildVolumeAdvice = (
  actions: CoachAction[],
  volumeAdaptation?: VolumeAdaptationReport | null,
  knownDraftTargets?: Set<string>,
): AggregatedPlanAdvice | null => {
  const items = volumeItems(volumeAdaptation, knownDraftTargets);
  if (!items.length && !actions.length) return null;

  const affected = uniqueAffectedItems([
    ...items.map<AggregatedPlanAdviceAffectedItem>((item) => ({
      type: 'muscle',
      id: item.muscleId,
      label: formatMuscleName(item.muscleId),
      summary: volumeDecisionSummary(item),
    })),
    ...actions.filter((action) => action.targetId).map(affectedFromAction),
  ]);
  const labels = affected.map((item) => item.label).filter(Boolean);
  const allIncrease = items.length > 0 && items.every((item) => item.decision === 'increase');
  const allDecrease = items.length > 0 && items.every((item) => item.decision === 'decrease');
  const summaryTarget = labels.length ? `${labels.slice(0, 5).join('、')}${allIncrease ? '低于目标' : allDecrease ? '负担偏高' : '需要复查'}` : '训练量需要复查';
  const draftAction = actions.find((action) => action.actionType === 'create_plan_adjustment_preview' && action.targetId);
  const reviewAction = actions.find((action) => action.actionType === 'review_volume') || actions[0];
  const primaryCoachAction = draftAction || reviewAction;
  const primaryAction: AggregatedPlanAdviceAction | undefined = primaryCoachAction
    ? {
        label: draftAction ? '生成调整草案' : '查看训练量建议',
        actionType: primaryCoachAction.actionType,
        variant: draftAction ? 'primary' : 'secondary',
        coachAction: primaryCoachAction,
      }
    : undefined;

  return {
    id: 'plan-advice-volume',
    category: 'volume',
    title: '训练量建议',
    summary: `${summaryTarget}，展开后查看每个肌群。`,
    priority: strongestPriority(actions.map((action) => action.priority).concat(items.length ? ['medium'] : [])),
    status: draftAction ? 'needs_confirmation' : 'suggestion',
    affectedItems: affected,
    primaryAction,
    secondaryActions: primaryCoachAction
      ? [
          {
            label: '暂不处理',
            actionType: 'dismiss',
            variant: 'ghost',
            coachAction: primaryCoachAction,
          },
        ]
      : undefined,
    sourceActionIds: actions.map((action) => action.id),
  };
};

const buildGroupedActionAdvice = (category: AggregatedPlanAdviceCategory, actions: CoachAction[]): AggregatedPlanAdvice | null => {
  if (!actions.length) return null;
  const primary = actions.find((action) => action.actionType === 'create_plan_adjustment_preview' && action.targetId) || actions[0];
  const affected = uniqueAffectedItems(actions.filter((action) => action.targetId).map(affectedFromAction));
  const labels = affected.map((item) => item.label).filter(Boolean);
  const labelText = labels.length ? labels.slice(0, 4).join('、') : '相关项目';
  const title =
    category === 'plateau'
      ? '动作进展建议'
      : category === 'recovery'
        ? '恢复建议'
        : category === 'data_health'
          ? '数据健康提醒'
          : category === 'template'
            ? '模板建议'
            : '计划建议';
  const summary =
    category === 'plateau'
      ? `${labelText}需要复查进展，展开后查看原因。`
      : cleanText(primary.description || primary.reason, '展开后查看建议原因。');
  return {
    id: `plan-advice-${category}`,
    category,
    title,
    summary,
    priority: strongestPriority(actions.map((action) => action.priority)),
    status: primary.requiresConfirmation ? 'needs_confirmation' : 'suggestion',
    affectedItems: affected,
    primaryAction: {
      label: primary.actionType === 'create_plan_adjustment_preview' && primary.targetId ? '生成调整草案' : category === 'plateau' ? '查看动作进展' : '查看建议',
      actionType: primary.actionType,
      variant: primary.actionType === 'create_plan_adjustment_preview' && primary.targetId ? 'primary' : 'secondary',
      coachAction: primary,
    },
    secondaryActions: [
      {
        label: '暂不处理',
        actionType: 'dismiss',
        variant: 'ghost',
        coachAction: primary,
      },
    ],
    sourceActionIds: actions.map((action) => action.id),
  };
};

const buildDraftAdvice = (drafts: ProgramAdjustmentDraft[]): AggregatedPlanAdvice[] =>
  dedupeProgramAdjustmentDraftsByFingerprint(drafts.filter(isRealDraft)).map((draft) => ({
    id: `plan-advice-draft-${draft.id}`,
    category: 'draft',
    title: cleanText(draft.title || draft.experimentalTemplateName, '调整草案'),
    summary: cleanText(draft.summary || draft.explanation, '应用前需要确认，不会自动覆盖原计划。'),
    priority: draft.riskLevel === 'high' ? 'high' : draft.riskLevel === 'medium' ? 'medium' : 'low',
    status: draftStatus(draft),
    affectedItems: (draft.changes || []).slice(0, 4).map((change) => ({
      type: change.muscleId ? 'muscle' : change.exerciseId ? 'exercise' : 'template',
      id: change.muscleId || change.exerciseId || change.dayTemplateId || change.id,
      label: change.muscleId ? formatMuscleName(change.muscleId) : change.exerciseId ? formatExerciseName(change.exerciseId) : formatTemplateName(change.dayTemplateName || change.dayTemplateId || ''),
      summary: cleanText(change.reason || change.previewNote, `${formatRiskLevel(draft.riskLevel || 'low')}，应用前请查看差异。`),
    })),
    sourceActionIds: [draft.sourceRecommendationId, ...(draft.selectedRecommendationIds || [])].filter(Boolean) as string[],
  }));

export const aggregatePlanAdvice = (
  actions: CoachAction[] = [],
  volumeAdaptation?: VolumeAdaptationReport | null,
  drafts: ProgramAdjustmentDraft[] = [],
): AggregatedPlanAdvice[] => {
  const knownDraftActionIds = draftActionIds(drafts.filter(isRealDraft));
  const knownDraftFingerprints = draftFingerprints(drafts.filter(isRealDraft));
  const knownDraftTargets = draftTargets(drafts.filter(isRealDraft));
  const realDrafts = drafts.filter(isRealDraft);
  const pendingActions = dedupeActions(
    actions
      .filter((action) => action.status === 'pending')
      .filter((action) => !action.sourceFingerprint || !knownDraftFingerprints.has(action.sourceFingerprint))
      .filter((action) => !shouldExcludeActionForDraft(action, knownDraftActionIds, knownDraftTargets))
      .filter((action) => !realDrafts.some((draft) => draftMatchesCoachAction(action, draft))),
  );
  const grouped = new Map<AggregatedPlanAdviceCategory, CoachAction[]>();
  pendingActions.forEach((action) => {
    const category = planCategoryForAction(action);
    if (category === 'data_health' && action.priority !== 'urgent' && action.priority !== 'high') return;
    grouped.set(category, [...(grouped.get(category) || []), action]);
  });

  const advice = [
    buildVolumeAdvice(grouped.get('volume') || [], volumeAdaptation, knownDraftTargets),
    buildGroupedActionAdvice('plateau', grouped.get('plateau') || []),
    buildGroupedActionAdvice('recovery', grouped.get('recovery') || []),
    buildGroupedActionAdvice('data_health', grouped.get('data_health') || []),
    buildGroupedActionAdvice('template', grouped.get('template') || []),
    buildGroupedActionAdvice('other', grouped.get('other') || []),
    ...buildDraftAdvice(drafts),
  ].filter((item): item is AggregatedPlanAdvice => Boolean(item));

  return advice.sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority] || left.title.localeCompare(right.title, 'zh-Hans-CN'));
};
