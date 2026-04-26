import { getEvidenceSource } from './evidenceSources';

export type EvidenceConfidence = 'high' | 'moderate' | 'low';

export interface EvidenceRule {
  id: string;
  label: string;
  practicalSummary: string;
  appliesTo: string[];
  confidence: EvidenceConfidence;
  sourceIds: string[];
  caveat: string;
}

export const EVIDENCE_RULES: EvidenceRule[] = [
  {
    id: 'hypertrophy_rep_range',
    label: '肌肥大常用重复范围',
    practicalSummary: '多数肌肥大工作组可落在 6-15 次；孤立动作可使用更高次数，以稳定动作质量和目标肌群刺激。',
    appliesTo: ['主训练', '辅助训练', '动作处方'],
    confidence: 'moderate',
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews'],
    caveat: '重复次数不是唯一决定因素，仍需结合接近力竭程度、动作质量和恢复情况。',
  },
  {
    id: 'strength_rep_range',
    label: '力量倾向重复范围',
    practicalSummary: '力量倾向训练通常使用较低次数、较高负荷和更充分休息，同时保留可重复的技术标准。',
    appliesTo: ['主训练', '顶组', '力量目标'],
    confidence: 'moderate',
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    caveat: '高负荷训练对技术和恢复要求更高，不应在动作质量或不适信号较差时强行推进。',
  },
  {
    id: 'rir_effort_control',
    label: 'RIR 努力程度控制',
    practicalSummary: '多数工作组建议控制在 RIR 1-3，以兼顾有效刺激、动作质量和可持续恢复。',
    appliesTo: ['训练记录', '进阶建议', '有效组判断'],
    confidence: 'moderate',
    sourceIds: ['hypertrophy_volume_reviews', 'strength_programming_consensus'],
    caveat: 'RIR 是主观估计，初学者误差可能更大，应结合完成质量和历史趋势判断。',
  },
  {
    id: 'rest_interval_compound',
    label: '复合动作休息区间',
    practicalSummary: '复合动作通常需要 120-240 秒休息，以维持顶组和回退组质量。',
    appliesTo: ['休息计时', '主训练', '顶组/回退组'],
    confidence: 'moderate',
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    caveat: '休息时间可根据训练密度、时间限制和个人恢复能力调整。',
  },
  {
    id: 'rest_interval_isolation',
    label: '孤立动作休息区间',
    practicalSummary: '孤立动作可使用相对较短休息，常见为 45-90 秒，重点是稳定完成目标肌群刺激。',
    appliesTo: ['辅助训练', '休息计时'],
    confidence: 'moderate',
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews'],
    caveat: '若动作质量明显下降或目标次数无法维持，应延长休息或降低负荷。',
  },
  {
    id: 'progressive_overload',
    label: '渐进超负荷',
    practicalSummary: '当连续训练中次数、RIR 和动作质量稳定达标时，再小幅增加重量或训练量。',
    appliesTo: ['进阶建议', '训练计划', 'PR 判断'],
    confidence: 'high',
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    caveat: '超负荷应建立在可恢复、可重复和动作质量合格的基础上。',
  },
  {
    id: 'deload_volume_reduction',
    label: '减量周训练量下修',
    practicalSummary: '减量周通常保留动作模式，但将训练量下修到常规周的约 50%-70%，让疲劳回落。',
    appliesTo: ['减量周', '疲劳管理', '周期计划'],
    confidence: 'moderate',
    sourceIds: ['strength_programming_consensus', 'hypertrophy_volume_reviews'],
    caveat: '减量幅度应根据疲劳、睡眠、表现下降和不适信号动态调整。',
  },
  {
    id: 'technique_quality_gate',
    label: '动作质量闸门',
    practicalSummary: '动作质量较差时，即使次数达标，也不应把该组作为加重或高质量 PR 的主要依据。',
    appliesTo: ['进阶建议', '有效组判断', 'PR 判断'],
    confidence: 'moderate',
    sourceIds: ['strength_programming_consensus'],
    caveat: '动作质量记录依赖用户自评，建议结合 ROM、节奏和不适标记一起判断。',
  },
  {
    id: 'pain_conservative_rule',
    label: '不适信号保守规则',
    practicalSummary: '出现不适时优先降低压力、缩小幅度、替代动作或进入减量策略；反复出现时提高保守等级。',
    appliesTo: ['不适模式', '替代动作', '进阶建议'],
    confidence: 'moderate',
    sourceIds: ['pain_training_boundary_consensus'],
    caveat: '该规则只用于训练层面的保守调整，不用于诊断或治疗。',
  },
  {
    id: 'weekly_volume_distribution',
    label: '每周训练量分配',
    practicalSummary: '肌群训练量应按周预算分配，优先保证主训练有效组，恢复额度不足时不强行补满。',
    appliesTo: ['周剂量预算', '今日计划', '完成度调整'],
    confidence: 'moderate',
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews'],
    caveat: '训练量目标是实践区间，不是硬性配额；长期完成度和恢复反馈同样重要。',
  },
];

export const EVIDENCE_RULE_MAP = EVIDENCE_RULES.reduce<Record<string, EvidenceRule>>((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {});

export const getEvidenceRule = (id: string) => EVIDENCE_RULE_MAP[id];

export const formatEvidenceRuleLabel = (id: string) => getEvidenceRule(id)?.label || '训练实践原则';

export const validateEvidenceRules = () =>
  EVIDENCE_RULES.every(
    (rule) =>
      Boolean(rule.label && rule.practicalSummary && rule.confidence && rule.caveat) &&
      rule.sourceIds.length > 0 &&
      rule.sourceIds.every((sourceId) => {
        const source = getEvidenceSource(sourceId);
        return Boolean(source?.title && source.type && source.note && source.lastReviewedAt && source.useFor.length);
      })
  );

export const TRAINING_STANDARDS = {
  hypertrophyRepRange: {
    min: 6,
    max: 15,
    note: EVIDENCE_RULE_MAP.hypertrophy_rep_range.practicalSummary,
  },
  isolationRepRange: {
    min: 10,
    max: 20,
    note: '孤立动作通常更适合用中高次数和更稳定的动作质量完成。',
  },
  strengthRepRange: {
    min: 3,
    max: 6,
    note: EVIDENCE_RULE_MAP.strength_rep_range.practicalSummary,
  },
  compoundRestSec: {
    min: 120,
    max: 240,
    note: EVIDENCE_RULE_MAP.rest_interval_compound.practicalSummary,
  },
  isolationRestSec: {
    min: 45,
    max: 90,
    note: EVIDENCE_RULE_MAP.rest_interval_isolation.practicalSummary,
  },
  rirRecommendedRange: {
    min: 1,
    max: 3,
    note: EVIDENCE_RULE_MAP.rir_effort_control.practicalSummary,
  },
  poorTechniqueProgression: {
    progressionAllowed: false,
    note: EVIDENCE_RULE_MAP.technique_quality_gate.practicalSummary,
  },
  painConservativeRule: {
    note: EVIDENCE_RULE_MAP.pain_conservative_rule.practicalSummary,
  },
  deloadVolumeMultiplier: {
    min: 0.5,
    max: 0.7,
    note: EVIDENCE_RULE_MAP.deload_volume_reduction.practicalSummary,
  },
} as const;

export const getRestRangeLabel = (kind: 'compound' | 'isolation') => {
  const range = kind === 'compound' ? TRAINING_STANDARDS.compoundRestSec : TRAINING_STANDARDS.isolationRestSec;
  return `${range.min}-${range.max} 秒`;
};
