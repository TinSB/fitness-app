import { EXERCISE_DISPLAY_NAMES } from '../data/trainingData';
import {
  DELOAD_LEVEL_LABELS,
  INTENSITY_BIAS_LABELS,
  PHASE_LABELS,
  READINESS_ADJUSTMENT_LABELS,
  SKIP_REASON_LABELS,
  SUPPORT_BLOCK_LABELS,
  TECHNIQUE_QUALITY_LABELS,
} from './terms';

const fallback = (value: unknown, empty = '未记录') => {
  if (value === undefined || value === null || value === '') return empty;
  return `未识别：${String(value)}`;
};

const TEMPLATE_NAME_MAP: Record<string, string> = {
  'push-a': 'Push A',
  'pull-a': 'Pull A',
  'legs-a': 'Legs A',
  upper: 'Upper',
  lower: 'Lower',
  arms: '手臂补量',
  'quick-30': '30 分钟快练',
  'crowded-gym': '人多替代',
};

const humanizeId = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatCyclePhase = (value: unknown) => PHASE_LABELS[value as keyof typeof PHASE_LABELS] ?? fallback(value);

export const formatIntensityBias = (value: unknown) =>
  INTENSITY_BIAS_LABELS[value as keyof typeof INTENSITY_BIAS_LABELS] ?? fallback(value);

export const formatSplitType = (value: unknown) =>
  (
    {
      upper_lower: '上下肢分化',
      push_pull_legs: '推拉腿分化',
      full_body: '全身训练',
      body_part: '部位分化',
      custom: '自定义计划',
    } as const
  )[value as string] ?? fallback(value);

export const formatGoal = (value: unknown) =>
  (
    {
      hypertrophy: '肌肥大',
      strength: '力量',
      fat_loss: '减脂',
    } as const
  )[value as string] ?? fallback(value);

export const formatBlockType = (value: unknown) =>
  (
    {
      main: '主训练',
      accessory: '辅助训练',
      correction: SUPPORT_BLOCK_LABELS.correction,
      functional: SUPPORT_BLOCK_LABELS.functional,
    } as const
  )[value as string] ?? fallback(value);

export const formatTechniqueQuality = (value: unknown) =>
  TECHNIQUE_QUALITY_LABELS[value as keyof typeof TECHNIQUE_QUALITY_LABELS] ?? fallback(value);

export const formatReadinessLevel = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中',
      high: '高',
    } as const
  )[value as string] ?? fallback(value);

export const formatTrainingAdjustment = (value: unknown) =>
  READINESS_ADJUSTMENT_LABELS[value as keyof typeof READINESS_ADJUSTMENT_LABELS] ?? fallback(value);

export const formatAdherenceConfidence = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中',
      high: '高',
      moderate: '中',
    } as const
  )[value as string] ?? fallback(value);

export const formatSkippedReason = (value: unknown) => SKIP_REASON_LABELS[value as keyof typeof SKIP_REASON_LABELS] ?? fallback(value);

export const formatPainAction = (value: unknown) =>
  (
    {
      watch: '继续观察',
      substitute: '优先替代动作',
      deload: '建议减量',
      seek_professional: '建议咨询专业人士',
    } as const
  )[value as string] ?? fallback(value);

export const formatSupportDoseAdjustment = (value: unknown) =>
  (
    {
      keep: '保持当前剂量',
      baseline: '基础剂量',
      boost: '提高剂量',
      taper: '维持剂量',
      reduce: '减少剂量',
      minimal: '最低有效剂量',
      remove_optional: '移除可选补丁',
    } as const
  )[value as string] ?? fallback(value);

export const formatComplexityLevel = (value: unknown) =>
  (
    {
      normal: '正常复杂度',
      reduced: '简化计划',
      minimal: '最小可执行计划',
    } as const
  )[value as string] ?? fallback(value);

export const formatPersonalRecordQuality = (value: unknown) =>
  (
    {
      standard: '普通记录',
      high_quality: '高质量记录',
      low_confidence: '低置信记录',
    } as const
  )[value as string] ?? fallback(value);

export const formatEvidenceConfidence = (value: unknown) =>
  (
    {
      high: '证据置信度高',
      moderate: '证据置信度中等',
      low: '证据置信度有限',
    } as const
  )[value as string] ?? fallback(value);

export const formatDeloadLevel = (value: unknown) => DELOAD_LEVEL_LABELS[value as keyof typeof DELOAD_LEVEL_LABELS] ?? fallback(value);

export const formatWeeklyActionPriority = (value: unknown) =>
  (
    {
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
    } as const
  )[value as string] ?? fallback(value);

export const formatWeeklyActionCategory = (value: unknown) =>
  (
    {
      volume: '训练量',
      recovery: '恢复管理',
      exercise_selection: '动作选择',
      technique: '动作质量',
      pain: '不适管理',
      adherence: '完成度',
      load_feedback: '重量反馈',
      mesocycle: '周期安排',
    } as const
  )[value as string] ?? fallback(value);

export const formatProgramTemplateName = (value: unknown, fallbackLabel = '未知模板') => {
  if (typeof value === 'object' && value && 'name' in value && typeof (value as { name?: unknown }).name === 'string') {
    return (value as { name: string }).name || fallbackLabel;
  }
  if (typeof value === 'string' && value.trim()) {
    return TEMPLATE_NAME_MAP[value] || humanizeId(value) || fallbackLabel;
  }
  return fallbackLabel;
};

export const formatDayTemplateName = (value: unknown, fallbackLabel = '未指定训练日') => {
  if (typeof value === 'object' && value && 'name' in value && typeof (value as { name?: unknown }).name === 'string') {
    return (value as { name: string }).name || fallbackLabel;
  }
  if (typeof value === 'string' && value.trim()) {
    return TEMPLATE_NAME_MAP[value] || humanizeId(value) || fallbackLabel;
  }
  return fallbackLabel;
};

export const formatExerciseName = (value: unknown, fallbackLabel = '未知动作') => {
  if (typeof value === 'object' && value) {
    const alias = typeof (value as { alias?: unknown }).alias === 'string' ? (value as { alias: string }).alias : '';
    const name = typeof (value as { name?: unknown }).name === 'string' ? (value as { name: string }).name : '';
    return alias || name || fallbackLabel;
  }
  if (typeof value === 'string' && value.trim()) {
    return EXERCISE_DISPLAY_NAMES[value] || humanizeId(value) || fallbackLabel;
  }
  return fallbackLabel;
};

export const formatAdjustmentChangeLabel = (value: unknown) =>
  (
    {
      add_sets: '增加组数',
      remove_sets: '减少组数',
      add_new_exercise: '新增动作',
      swap_exercise: '替代动作',
      reduce_support: '减少 support',
      increase_support: '增加 support',
      keep: '保持当前结构',
    } as const
  )[value as string] ?? '计划调整';

export const formatAdjustmentRiskLevel = (value: unknown) =>
  (
    {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
    } as const
  )[value as string] ?? '需人工复核';

export const formatAdjustmentReviewStatus = (value: unknown) =>
  (
    {
      too_early: '数据还太早',
      improved: '已改善',
      neutral: '无明显变化',
      worse: '变差',
      insufficient_data: '数据不足',
    } as const
  )[value as string] ?? '待观察';
