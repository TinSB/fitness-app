import type { CoachAction, CoachActionPriority, CoachActionSource, CoachActionStatus, CoachActionType } from '../engines/coachActionEngine';
import type { UiTone } from '../ui/Card';

export type CoachActionView = {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  priorityLabel: string;
  priorityTone: UiTone;
  statusLabel: string;
  statusTone: UiTone;
  primaryLabel: string;
  secondaryLabel: string;
  detailLabel: string;
  requiresConfirmation: boolean;
  reversible: boolean;
  action: CoachAction;
};

export type CoachActionListViewModel = {
  pending: CoachActionView[];
  applied: CoachActionView[];
  dismissed: CoachActionView[];
  expired: CoachActionView[];
  failed: CoachActionView[];
  totalCount: number;
};

export type CoachActionSurface = 'today' | 'profile' | 'record' | 'plan';

type BuildCoachActionListOptions = {
  surface?: CoachActionSurface;
  maxVisible?: number;
};

const sourceLabels: Record<CoachActionSource, string> = {
  dailyAdjustment: '今日调整',
  nextWorkout: '下次训练',
  dataHealth: '数据健康',
  plateau: '动作进展',
  volumeAdaptation: '训练量',
  sessionQuality: '训练质量',
  setAnomaly: '输入检查',
  recovery: '恢复建议',
  recommendationConfidence: '推荐可信度',
};

const statusLabels: Record<CoachActionStatus, string> = {
  pending: '待处理',
  applied: '已采用',
  dismissed: '已忽略',
  expired: '已过期',
  failed: '未完成',
};

const priorityLabels: Record<CoachActionPriority, string> = {
  urgent: '优先处理',
  high: '重要',
  medium: '建议查看',
  low: '可稍后看',
};

const priorityRank: Record<CoachActionPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const priorityTone: Record<CoachActionPriority, UiTone> = {
  urgent: 'rose',
  high: 'amber',
  medium: 'sky',
  low: 'slate',
};

const statusTone: Record<CoachActionStatus, UiTone> = {
  pending: 'sky',
  applied: 'emerald',
  dismissed: 'slate',
  expired: 'amber',
  failed: 'rose',
};

const rawTokenPattern =
  /\b(undefined|null|dailyAdjustment|nextWorkout|dataHealth|plateau|volumeAdaptation|sessionQuality|setAnomaly|recovery|recommendationConfidence|apply_temporary_session_adjustment|create_plan_adjustment_preview|open_record_detail|open_data_health|open_replacement_sheet|review_volume|review_exercise|review_session|open_next_workout|dismiss|keep_observing|pending|applied|dismissed|expired|failed|urgent|high|medium|low)\b/gi;

const mojibakePattern = /(锛|銆|鏁|璁|绋|惧|褰|浠|涓|寤|妫|鍋|淇|湪|啋|槸|璇|伅|€)/;

const cleanText = (value: unknown, fallback: string) => {
  const text = String(value ?? '')
    .replace(rawTokenPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || mojibakePattern.test(text)) return fallback;
  return text;
};

const fallbackTitle = (action: CoachAction) => {
  if (action.source === 'dataHealth') return '检查数据健康';
  if (action.source === 'dailyAdjustment') return '查看今日调整';
  if (action.source === 'nextWorkout') return '查看下次训练建议';
  if (action.source === 'plateau') return action.actionType === 'create_plan_adjustment_preview' ? '生成动作调整草案' : '查看动作进展';
  if (action.source === 'volumeAdaptation') return action.actionType === 'create_plan_adjustment_preview' ? '生成训练量调整草案' : '查看训练量建议';
  if (action.source === 'sessionQuality') return '查看训练质量';
  if (action.source === 'setAnomaly') return '复查训练输入';
  if (action.source === 'recovery') return '查看恢复训练建议';
  if (action.source === 'recommendationConfidence') return '查看推荐可信度';
  return '查看教练建议';
};

const fallbackDescription = (action: CoachAction) => {
  if (action.source === 'dataHealth') return '有数据问题建议先查看；本操作只会打开相关页面，不会修改数据。';
  if (action.actionType === 'create_plan_adjustment_preview') return '可以查看调整草案入口，正式应用仍需要你确认。';
  if (action.actionType === 'apply_temporary_session_adjustment') return '当前只展示建议，不会自动修改训练内容。';
  if (action.actionType === 'review_session') return '打开相关训练详情，确认记录和统计是否一致。';
  if (action.actionType === 'open_next_workout') return '查看系统建议的下次训练安排。';
  return '查看建议详情；你可以暂不处理。';
};

export const getCoachActionPrimaryLabel = (actionType: CoachActionType, source?: CoachActionSource) => {
  if (actionType === 'open_data_health') return '查看数据';
  if (actionType === 'open_record_detail' || actionType === 'review_session') return '查看训练详情';
  if (actionType === 'create_plan_adjustment_preview') return '生成调整草案';
  if (actionType === 'review_volume') return '查看训练量';
  if (actionType === 'review_exercise') return '查看动作';
  if (actionType === 'open_next_workout') return '查看建议';
  if (actionType === 'open_replacement_sheet') return '查看替代动作';
  if (actionType === 'apply_temporary_session_adjustment') return source === 'dailyAdjustment' ? '采用本次调整' : '查看建议';
  return '查看建议';
};

export function buildCoachActionView(action: CoachAction): CoachActionView {
  return {
    id: action.id || 'coach-action',
    title: cleanText(action.title, fallbackTitle(action)),
    description: cleanText(action.description || action.reason, fallbackDescription(action)),
    sourceLabel: sourceLabels[action.source] || '教练建议',
    priorityLabel: priorityLabels[action.priority] || '建议查看',
    priorityTone: priorityTone[action.priority] || 'slate',
    statusLabel: statusLabels[action.status] || '待处理',
    statusTone: statusTone[action.status] || 'slate',
    primaryLabel: getCoachActionPrimaryLabel(action.actionType, action.source),
    secondaryLabel: '暂不处理',
    detailLabel: '查看详情',
    requiresConfirmation: Boolean(action.requiresConfirmation),
    reversible: Boolean(action.reversible),
    action,
  };
}

const sortActionViews = (actions: CoachActionView[]) =>
  [...actions].sort((left, right) => {
    const priorityDiff = priorityRank[right.action.priority] - priorityRank[left.action.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return left.title.localeCompare(right.title, 'zh-Hans-CN');
  });

const shouldShowOnSurface = (action: CoachAction, surface: CoachActionSurface) => {
  if (surface === 'today') return action.status === 'pending';
  if (surface === 'record') return action.source === 'dataHealth' || action.actionType === 'review_session' || action.actionType === 'open_record_detail';
  if (surface === 'plan') return action.source === 'plateau' || action.source === 'volumeAdaptation' || action.actionType === 'create_plan_adjustment_preview';
  return true;
};

export function buildCoachActionListViewModel(
  actions: CoachAction[],
  { surface = 'profile', maxVisible }: BuildCoachActionListOptions = {},
): CoachActionListViewModel {
  const views = sortActionViews(actions.filter((action) => shouldShowOnSurface(action, surface)).map(buildCoachActionView));
  const limited = surface === 'today' && maxVisible ? views.slice(0, maxVisible) : views;
  const byStatus = (status: CoachActionStatus) => limited.filter((view) => view.action.status === status);

  return {
    pending: byStatus('pending'),
    applied: byStatus('applied'),
    dismissed: byStatus('dismissed'),
    expired: byStatus('expired'),
    failed: byStatus('failed'),
    totalCount: views.length,
  };
}
