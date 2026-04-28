import { formatExerciseDisplayName } from '../data/trainingData';
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
      hypertrophy: '肌肥大（增肌）',
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
      medium: '中等',
      high: '高',
      standard: '标准',
    } as const
  )[value as string] ?? fallback(value);

export const formatConfidence = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中等',
      moderate: '中等',
      high: '高',
    } as const
  )[value as string] ?? fallback(value);

export const formatFatigueCost = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中等',
      high: '高',
    } as const
  )[value as string] ?? fallback(value);

export const formatSkillDemand = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中等',
      high: '高',
    } as const
  )[value as string] ?? fallback(value);

export const formatRomPriority = (value: unknown) =>
  (
    {
      low: '幅度优先级低',
      medium: '幅度优先级中等',
      high: '幅度优先级高',
    } as const
  )[value as string] ?? fallback(value);

export const formatBooleanStatus = (value: unknown, labels: { yes: string; no: string } = { yes: '是', no: '否' }) =>
  value === true ? labels.yes : value === false ? labels.no : fallback(value);

export const formatPriority = (value: unknown) =>
  (
    {
      priority: '优先',
      primary: '优先',
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
      secondary: '次选',
      optional: '可选',
    } as const
  )[value as string] ?? fallback(value);

export const formatReplacementCategory = (value: unknown) =>
  (
    {
      priority: '优先',
      optional: '可选',
      angle: '角度变化',
      not_recommended: '不推荐',
      avoid: '不推荐',
    } as const
  )[value as string] ?? fallback(value);

export const formatWarmupPolicy = (value: unknown) =>
  (
    {
      required: '需要热身',
      optional: '可选热身',
      skipped_by_policy: '按策略跳过',
      none: '无热身',
    } as const
  )[value as string] ?? fallback(value);

export const formatDataFlag = (value: unknown) =>
  (
    {
      normal: '正常数据',
      test: '测试数据',
      excluded: '排除数据',
    } as const
  )[value as string] ?? fallback(value);

export const formatTrainingAdjustment = (value: unknown) =>
  READINESS_ADJUSTMENT_LABELS[value as keyof typeof READINESS_ADJUSTMENT_LABELS] ?? fallback(value);

export const formatAdherenceConfidence = (value: unknown) =>
  (
    {
      low: '低',
      medium: '中等',
      high: '高',
      moderate: '中等',
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

export const formatEvidenceTier = (value: unknown) =>
  (
    {
      A: '直接权威依据',
      B: '研究支持规则',
      C: '产品化辅助规则',
    } as const
  )[value as string] ?? fallback(value);

export const formatEvidenceImplementationType = (value: unknown) =>
  (
    {
      direct_guideline: '指南直接支持',
      research_supported: '研究支持',
      product_heuristic: '产品化估算',
    } as const
  )[value as string] ?? fallback(value);

export const formatAuthorityLevel = (value: unknown) =>
  (
    {
      highest: '最高权威',
      high: '高权威',
      professional_standard: '专业标准',
      contextual: '背景参考',
      market_only: '行业市场参考',
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
  return formatExerciseDisplayName(value, { fallback: fallbackLabel });
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

export const formatRiskLevel = formatAdjustmentRiskLevel;

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
