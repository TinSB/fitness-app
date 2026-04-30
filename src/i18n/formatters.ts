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

const isDev = () => typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const warnMissingFormatter = (formatterName: string, value: unknown) => {
  if (typeof console !== 'undefined' && isDev()) {
    console.warn(`[IronPath] ${formatterName} 缺少中文显示映射`, value);
  }
};

const fallback = (value: unknown, empty = '未记录', formatterName = 'formatter') => {
  if (value === undefined || value === null || value === '') return empty;
  warnMissingFormatter(formatterName, value);
  return '未知状态';
};

const normalizeDisplayKey = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

const lookupLabel = (
  formatterName: string,
  value: unknown,
  labels: Record<string, string>,
  empty = '未知状态',
): string => {
  if (value === undefined || value === null || value === '') return empty;
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    const name = (value as { name?: unknown }).name;
    const nameZh = (value as { nameZh?: unknown }).nameZh;
    const label = (value as { label?: unknown }).label;
    const candidates = [id, name, nameZh, label];
    for (const candidate of candidates) {
      const normalized = normalizeDisplayKey(candidate);
      if (labels[normalized]) return labels[normalized];
    }
    if (typeof nameZh === 'string' && /[\u3400-\u9fff]/.test(nameZh)) return nameZh;
    if (typeof name === 'string' && /[\u3400-\u9fff]/.test(name)) return name;
  }
  const normalized = normalizeDisplayKey(value);
  if (labels[normalized]) return labels[normalized];
  if (typeof value === 'string' && /[\u3400-\u9fff]/.test(value)) return value;
  warnMissingFormatter(formatterName, value);
  return empty;
};

const TEMPLATE_NAME_MAP: Record<string, string> = {
  'push-a': '推 A',
  pusha: '推 A',
  push: '推 A',
  'pull-a': '拉 A',
  pulla: '拉 A',
  pull: '拉 A',
  'legs-a': '腿 A',
  legsa: '腿 A',
  legs: '腿 A',
  'upper-a': '上肢 A',
  uppera: '上肢 A',
  upper: '上肢 A',
  'lower-a': '下肢 A',
  lowera: '下肢 A',
  lower: '下肢 A',
  'full-body': '全身训练',
  fullbody: '全身训练',
  arms: '手臂补量',
  'quick-30': '30 分钟快练',
  'crowded-gym': '人多替代',
};

const TRAINING_MODE_LABELS: Record<string, string> = {
  hybrid: '综合',
  strength: '力量',
  hypertrophy: '肌肥大（增肌）',
};

const PRIMARY_GOAL_LABELS: Record<string, string> = {
  fat_loss: '减脂',
  'fat-loss': '减脂',
  strength: '力量',
  hypertrophy: '肌肥大（增肌）',
  health: '健康维持',
  maintenance: '健康维持',
  health_maintenance: '健康维持',
  'health-maintenance': '健康维持',
};

const MUSCLE_LABELS: Record<string, string> = {
  chest: '胸',
  back: '背',
  lats: '背阔肌',
  legs: '腿',
  quads: '股四头肌',
  hamstrings: '腘绳肌',
  glutes: '臀',
  shoulders: '肩',
  delts: '三角肌',
  arms: '手臂',
  triceps: '肱三头肌',
  biceps: '肱二头肌',
  calves: '小腿',
  core: '核心',
  胸: '胸',
  背: '背',
  腿: '腿',
  肩: '肩',
  手臂: '手臂',
};

const MOVEMENT_PATTERN_LABELS: Record<string, string> = {
  horizontal_push: '水平推',
  'horizontal-push': '水平推',
  horizontalpress: '水平推',
  horizontal_press: '水平推',
  vertical_push: '垂直推',
  'vertical-push': '垂直推',
  verticalpress: '垂直推',
  vertical_press: '垂直推',
  horizontal_pull: '水平拉',
  'horizontal-pull': '水平拉',
  horizontalpull: '水平拉',
  vertical_pull: '垂直拉',
  'vertical-pull': '垂直拉',
  verticalpull: '垂直拉',
  squat: '深蹲',
  'squat-pattern': '深蹲',
  hinge: '髋铰链',
  'hinge-pattern': '髋铰链',
  lunge: '单腿',
  carry: '搬运',
  isolation_push: '孤立推',
  'isolation-push': '孤立推',
  isolation_pull: '孤立拉',
  'isolation-pull': '孤立拉',
  水平推: '水平推',
  垂直推: '垂直推',
  水平拉: '水平拉',
  垂直拉: '垂直拉',
  深蹲: '深蹲',
  髋铰链: '髋铰链',
};

const SET_TYPE_LABELS: Record<string, string> = {
  warmup: '热身组',
  working: '正式组',
  work: '正式组',
  top: '顶组',
  backoff: '回退组',
  straight: '正式组',
  support: '辅助动作',
  corrective: '纠偏组',
  correction: '纠偏组',
  functional: '功能补丁',
  replacement: '替代动作',
};

const LEVEL_LABELS: Record<string, string> = {
  low: '低',
  medium: '中等',
  moderate: '中等',
  high: '高',
};

const localizeTemplateNameText = (value: string) =>
  value
    .replace(/\bpush[\s_-]*a\b/gi, '推 A')
    .replace(/\bpull[\s_-]*a\b/gi, '拉 A')
    .replace(/\blegs[\s_-]*a\b/gi, '腿 A')
    .replace(/\bupper[\s_-]*a\b/gi, '上肢 A')
    .replace(/\blower[\s_-]*a\b/gi, '下肢 A')
    .replace(/\bfull[\s_-]*body\b/gi, '全身训练');

export const formatTemplateName = (value: unknown, fallbackLabel = '未命名') => {
  if (value === undefined || value === null || value === '') return fallbackLabel;
  const candidates =
    typeof value === 'object' && value
      ? [
          (value as { id?: unknown }).id,
          (value as { nameZh?: unknown }).nameZh,
          (value as { name?: unknown }).name,
          (value as { label?: unknown }).label,
        ]
      : [value];
  for (const candidate of candidates) {
    const normalized = normalizeDisplayKey(candidate);
    if (TEMPLATE_NAME_MAP[normalized]) return TEMPLATE_NAME_MAP[normalized];
    if (typeof candidate === 'string') {
      const localized = localizeTemplateNameText(candidate.trim());
      if (/[\u3400-\u9fff]/.test(localized) && !/\b(push|pull|legs|upper|lower|full body)\b/i.test(localized)) return localized;
    }
  }
  warnMissingFormatter('formatTemplateName', value);
  return fallbackLabel;
};

export const formatTrainingDayName = (value: unknown, fallbackLabel = '未命名') =>
  formatTemplateName(value, fallbackLabel);

export const formatTrainingMode = (value: unknown) =>
  lookupLabel('formatTrainingMode', value, TRAINING_MODE_LABELS);

export const formatPrimaryGoal = (value: unknown) =>
  lookupLabel('formatPrimaryGoal', value, PRIMARY_GOAL_LABELS);

export const formatMuscleName = (value: unknown) =>
  lookupLabel('formatMuscleName', value, MUSCLE_LABELS, '未标注肌群');

export const formatMovementPattern = (value: unknown) =>
  lookupLabel('formatMovementPattern', value, MOVEMENT_PATTERN_LABELS, '未标注模式');

export const formatSetType = (value: unknown) =>
  lookupLabel('formatSetType', value, SET_TYPE_LABELS);

export const formatSessionVolumeLabel = (scope: 'working' | 'including_warmup' = 'working') =>
  scope === 'including_warmup' ? '总量（含热身）' : '总量';

export const formatRirLabel = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '余力（RIR）未记录';
  const text = String(value).trim();
  if (!text) return '余力（RIR）未记录';
  if (text.includes('余力')) return text;
  const normalized = text.replace(/\s*RIR\s*/gi, '').trim().replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
  return `${normalized} RIR 余力`;
};

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

export const formatGoal = formatPrimaryGoal;

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
  lookupLabel('formatReadinessLevel', value, { ...LEVEL_LABELS, standard: '标准' });

export const formatConfidence = (value: unknown) =>
  lookupLabel('formatConfidence', value, LEVEL_LABELS);

export const formatFatigueCost = (value: unknown) =>
  lookupLabel('formatFatigueCost', value, LEVEL_LABELS);

export const formatSkillDemand = (value: unknown) =>
  lookupLabel('formatSkillDemand', value, LEVEL_LABELS);

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
  lookupLabel(
    'formatReplacementCategory',
    value,
    {
      priority: '优先',
      optional: '可选',
      angle: '角度变化',
      not_recommended: '不推荐',
      'not-recommended': '不推荐',
      avoid: '不推荐',
    },
  );

export const formatWarmupPolicy = (value: unknown) =>
  lookupLabel(
    'formatWarmupPolicy',
    value,
    {
      required: '需要热身',
      optional: '可选热身',
      skipped_by_policy: '按策略跳过',
      'skipped-by-policy': '按策略跳过',
      none: '无热身',
      auto: '自动热身',
      always: '固定热身',
      never: '不安排热身',
    },
  );

export const formatWarmupDecision = (value: unknown) =>
  lookupLabel(
    'formatWarmupDecision',
    value,
    {
      full_warmup: '完整热身',
      'full-warmup': '完整热身',
      feeder_set: '适应组',
      'feeder-set': '适应组',
      no_warmup: '无需热身',
      'no-warmup': '无需热身',
    },
  );

export const formatDataFlag = (value: unknown) =>
  lookupLabel(
    'formatDataFlag',
    value,
    {
      normal: '正常数据',
      test: '测试数据',
      excluded: '排除数据',
    },
  );

export const formatTrainingAdjustment = (value: unknown) =>
  READINESS_ADJUSTMENT_LABELS[value as keyof typeof READINESS_ADJUSTMENT_LABELS] ?? fallback(value);

export const formatAdherenceConfidence = formatConfidence;

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
  return formatTemplateName(value, fallbackLabel);
};

export const formatDayTemplateName = (value: unknown, fallbackLabel = '未指定训练日') => {
  return formatTrainingDayName(value, fallbackLabel);
};

export const formatExerciseName = (value: unknown, fallbackLabel = '未命名动作') => {
  return formatExerciseDisplayName(value, { fallback: fallbackLabel });
};

export const formatAdjustmentChangeLabel = (value: unknown) =>
  (
    {
      add_sets: '增加组数',
      remove_sets: '减少组数',
      add_new_exercise: '新增动作',
      swap_exercise: '替代动作',
      reduce_support: '减少辅助层',
      increase_support: '增加辅助层',
      keep: '保持当前结构',
    } as const
  )[value as string] ?? '计划调整';

export const formatAdjustmentRiskLevel = (value: unknown) =>
  lookupLabel('formatRiskLevel', value, {
    low: '低风险',
    medium: '中风险',
    moderate: '中风险',
    high: '高风险',
  }, '需人工复核');

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
