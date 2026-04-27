import { EVIDENCE_AUTHORITIES, getEvidenceAuthority } from './evidenceAuthorities';
import { validateEvidenceRuleAuthorityUsage } from './evidenceGovernance';
import { getEvidenceSource } from './evidenceSources';

export type EvidenceConfidence = 'high' | 'moderate' | 'low';
export type EvidenceTier = 'A' | 'B' | 'C';
export type EvidenceImplementationType = 'direct_guideline' | 'research_supported' | 'product_heuristic';

export interface EvidenceRule {
  id: string;
  title: string;
  label: string;
  practicalSummary: string;
  appliesTo: string[];
  sourceIds: string[];
  authorityIds: string[];
  implementationType: EvidenceImplementationType;
  evidenceTier: EvidenceTier;
  confidence: EvidenceConfidence;
  caveat: string;
}

export const EVIDENCE_RULES: EvidenceRule[] = [
  {
    id: 'weekly_volume_distribution',
    title: '每周训练量分配',
    label: '每周训练量分配',
    practicalSummary: '肌群训练量应按周预算分配，优先保证可恢复、可持续的有效组，而不是单日堆满动作。',
    appliesTo: ['周剂量预算', '今日计划', '完成度调整'],
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews'],
    authorityIds: ['acsm'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '周训练量目标是实践区间，不是硬性配额；长期完成度、恢复和动作质量同样重要。',
  },
  {
    id: 'hypertrophy_rep_range',
    title: '肌肥大常见重复范围',
    label: '肌肥大常见重复范围',
    practicalSummary: '多数肌肥大工作组可落在 6-15 次；孤立动作可以使用更高次数，以稳定动作质量和目标肌群刺激。',
    appliesTo: ['主训练', '辅助训练', '动作处方'],
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '重复次数不是唯一决定因素，仍需结合接近力竭程度、动作质量、训练量和恢复情况。',
  },
  {
    id: 'strength_rep_range',
    title: '力量训练重复范围',
    label: '力量训练重复范围',
    practicalSummary: '力量优先训练通常使用较低次数、较高负荷和更充分休息，同时保持可重复的技术标准。',
    appliesTo: ['主训练', '顶组', '力量目标'],
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '高负荷训练对技术和恢复要求更高，不应在动作质量或不适信号较差时强行推进。',
  },
  {
    id: 'rir_effort_control',
    title: 'RIR 努力程度控制',
    label: 'RIR 努力程度控制',
    practicalSummary: '多数工作组建议控制在 RIR 1-3 左右，以兼顾有效刺激、动作质量和可持续恢复。',
    appliesTo: ['训练记录', '进阶建议', '有效组判断'],
    sourceIds: ['rir_effort_reviews', 'hypertrophy_volume_reviews', 'strength_programming_consensus'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: 'RIR 是主观估计，初学者误差可能更大，应结合完成质量、疼痛信号和历史趋势判断。',
  },
  {
    id: 'rest_interval_compound',
    title: '复合动作休息区间',
    label: '复合动作休息区间',
    practicalSummary: '复合动作通常需要 120-240 秒休息，以维持顶组和回退组质量。',
    appliesTo: ['休息计时', '主训练', '顶组/回退组'],
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '休息时间可根据训练密度、时间限制和个人恢复能力调整。',
  },
  {
    id: 'rest_interval_isolation',
    title: '孤立动作休息区间',
    label: '孤立动作休息区间',
    practicalSummary: '孤立动作可使用相对较短休息，常见为 45-90 秒，重点是稳定完成目标肌群刺激。',
    appliesTo: ['辅助训练', '休息计时'],
    sourceIds: ['acsm_resistance_training_guidance', 'hypertrophy_volume_reviews'],
    authorityIds: ['acsm'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '如果动作质量明显下降或目标次数无法维持，应延长休息或降低负荷。',
  },
  {
    id: 'progressive_overload',
    title: '渐进超负荷',
    label: '渐进超负荷',
    practicalSummary: '当连续训练中次数、RIR 和动作质量稳定达标时，再小幅增加重量或训练量。',
    appliesTo: ['进阶建议', '训练计划', 'PR 判断'],
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'direct_guideline',
    evidenceTier: 'A',
    confidence: 'high',
    caveat: '超负荷应建立在可恢复、可重复和动作质量合格的基础上，不是每次训练都必须加重。',
  },
  {
    id: 'deload_volume_reduction',
    title: '减量周训练量下修',
    label: '减量周训练量下修',
    practicalSummary: '减量周通常保留动作模式，但下修训练量和强度压力，让疲劳回落。',
    appliesTo: ['减量周', '疲劳管理', '周期计划'],
    sourceIds: ['strength_programming_consensus', 'hypertrophy_volume_reviews', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '减量幅度应根据疲劳、睡眠、表现下降和不适信号动态调整，固定百分比只是产品默认值。',
  },
  {
    id: 'technique_quality_gate',
    title: '动作质量门槛',
    label: '动作质量门槛',
    practicalSummary: '动作质量较差时，即使次数达标，也不应把该组作为加重或高质量 PR 的主要依据。',
    appliesTo: ['进阶建议', '有效组判断', 'PR 判断'],
    sourceIds: ['strength_programming_consensus', 'nsca_strength_conditioning_reference'],
    authorityIds: ['nsca'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '动作质量记录依赖用户自评，建议结合 ROM、节奏和不适标记一起判断。',
  },
  {
    id: 'pain_conservative_rule',
    title: '不适信号保守处理',
    label: '不适信号保守处理',
    practicalSummary: '出现不适时优先降低压力、缩小幅度、替代动作或进入减量策略；反复出现时提高保守等级。',
    appliesTo: ['不适模式', '替代动作', '进阶建议'],
    sourceIds: ['acsm_resistance_training_guidance', 'pain_training_boundary_consensus'],
    authorityIds: ['acsm'],
    implementationType: 'research_supported',
    evidenceTier: 'B',
    confidence: 'moderate',
    caveat: '该规则只用于训练层面的保守调整，不用于诊断或治疗；持续疼痛应寻求专业人士评估。',
  },
  {
    id: 'e1rm_estimation',
    title: 'e1RM 估算',
    label: 'e1RM 估算',
    practicalSummary: 'e1RM 用最近高质量工作组估算理论单次最大重量，用于负荷建议和趋势观察。',
    appliesTo: ['负荷建议', 'PR 趋势', '训练复盘'],
    sourceIds: ['e1rm_estimation_references', 'strength_programming_consensus'],
    authorityIds: ['nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'moderate',
    caveat: 'e1RM 是估算，不等于真实 1RM 测试；动作质量、不适、重复次数范围和近期稳定性会影响可靠性。',
  },
  {
    id: 'effective_set_estimation',
    title: '有效组估算',
    label: '有效组估算',
    practicalSummary: '有效组根据工作组、RIR、动作质量、疼痛标记和负荷范围估算训练量质量。',
    appliesTo: ['有效组', '周训练量', '肌群仪表盘'],
    sourceIds: ['hypertrophy_volume_reviews', 'rir_effort_reviews'],
    authorityIds: ['acsm'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'moderate',
    caveat: '有效组是训练量估算，不是精确生理刺激测量；它用于趋势管理，不应被当作医学或实验室指标。',
  },
  {
    id: 'muscle_contribution_weighting',
    title: '肌群贡献权重',
    label: '肌群贡献权重',
    practicalSummary: '复合动作训练量按主要肌群和辅助肌群贡献权重分配，用于周训练量仪表盘。',
    appliesTo: ['肌群训练量', '动作贡献', '周剂量预算'],
    sourceIds: ['hypertrophy_volume_reviews', 'strength_programming_consensus'],
    authorityIds: ['nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '这是 app 内部训练量分配估算，不是权威机构给出的固定公式，也不是精确肌肉刺激测量。',
  },
  {
    id: 'readiness_score',
    title: '准备度评分',
    label: '准备度评分',
    practicalSummary: '准备度评分把睡眠、精力、酸痛、完成度和近期表现合并为当天训练保守程度参考。',
    appliesTo: ['今日状态', '训练调整', '减量提示'],
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '准备度评分是自我调节辅助，不是医学疲劳诊断；用户实际状态和疼痛信号优先。',
  },
  {
    id: 'warmup_policy',
    title: '热身策略',
    label: '热身策略',
    practicalSummary: '热身优先安排在第一个主复合动作或高技术/高负荷动作前，孤立动作默认不强制热身。',
    appliesTo: ['Focus Mode', '热身组', '动作顺序'],
    sourceIds: ['acsm_resistance_training_guidance', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'moderate',
    caveat: '热身策略是产品化默认规则，不是每个动作必须热身的权威公式；用户可根据当天状态覆盖。',
  },
  {
    id: 'auto_training_level_assessment',
    title: '自动训练等级评估',
    label: '自动训练等级评估',
    practicalSummary: '系统根据真实训练记录、力量稳定性、动作质量、完成度、不适信号、频率和有效组质量估算训练等级。',
    appliesTo: ['训练基线', '训练等级', '高级功能开放'],
    sourceIds: ['acsm_resistance_training_guidance', 'nsca_strength_conditioning_reference', 'strength_programming_consensus'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '训练等级由系统根据记录估算，不等于教练现场评估；单次大重量不能直接判定高阶。',
  },
  {
    id: 'baseline_building',
    title: '训练基线建立',
    label: '训练基线建立',
    practicalSummary: '零数据或少量数据阶段只表示系统数据不足，默认不伪造 PR、e1RM 或历史表现。',
    appliesTo: ['零数据状态', 'TodayView', 'RecordView', '初始模板'],
    sourceIds: ['acsm_resistance_training_guidance', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '基线建立是产品化训练决策辅助，不是 ACSM/NSCA 直接给出的固定记录次数公式。',
  },
  {
    id: 'level_gated_progression',
    title: '等级门控进阶',
    label: '等级门控进阶',
    practicalSummary: '在数据不足、完成度低、动作质量差或不适信号偏高时，系统关闭激进进阶和高容量建议。',
    appliesTo: ['进阶建议', 'top/backoff', '高容量模板'],
    sourceIds: ['acsm_resistance_training_guidance', 'strength_programming_consensus'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '等级门控是 app 的保守默认策略，不是权威机构直接规定的固定升级公式。',
  },
  {
    id: 'level_gated_exercise_complexity',
    title: '等级门控动作复杂度',
    label: '等级门控动作复杂度',
    practicalSummary: '系统根据等级、动作质量、不适信号和完成度逐步开放更复杂动作选择。',
    appliesTo: ['动作选择', '模板建议', '辅助层剂量'],
    sourceIds: ['acsm_resistance_training_guidance', 'nsca_strength_conditioning_reference'],
    authorityIds: ['acsm', 'nsca'],
    implementationType: 'product_heuristic',
    evidenceTier: 'C',
    confidence: 'low',
    caveat: '动作复杂度门控是产品化估算，不等于教练现场技术评估；用户状态和安全反馈优先。',
  },
  {
    id: 'health_baseline_activity',
    title: '健康最低活动标准',
    label: '健康最低活动标准',
    practicalSummary: '成年人长期健康目标应包含规律有氧活动和每周至少 2 天肌力训练。',
    appliesTo: ['健康底线', '长期习惯', '训练频率背景'],
    sourceIds: ['hhs_physical_activity_guidelines', 'cdc_healthy_people_2030'],
    authorityIds: ['hhs_paga', 'cdc_healthy_people_2030'],
    implementationType: 'direct_guideline',
    evidenceTier: 'A',
    confidence: 'high',
    caveat: '健康最低活动标准不等同于肌肥大或力量专项训练处方，不能单独决定卧推重量或每肌群周组数。',
  },
];

export const EVIDENCE_RULE_MAP = EVIDENCE_RULES.reduce<Record<string, EvidenceRule>>((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {});

export const getEvidenceRule = (id: string) => EVIDENCE_RULE_MAP[id];

export const formatEvidenceRuleLabel = (id: string) => getEvidenceRule(id)?.title || getEvidenceRule(id)?.label || '训练实践原则';

export const validateEvidenceRules = () => {
  const governanceIssues = validateEvidenceRuleAuthorityUsage(EVIDENCE_RULES, EVIDENCE_AUTHORITIES);
  const hasGovernanceErrors = governanceIssues.some((issue) => issue.severity === 'error');

  return (
    !hasGovernanceErrors &&
    EVIDENCE_RULES.every((rule) => {
      const hasRequiredFields =
        Boolean(rule.id && rule.title && rule.label && rule.practicalSummary && rule.confidence && rule.caveat) &&
        Boolean(rule.evidenceTier && rule.implementationType) &&
        rule.sourceIds.length > 0 &&
        rule.authorityIds.length > 0;

      const sourcesResolve = rule.sourceIds.every((sourceId) => {
        const source = getEvidenceSource(sourceId);
        return Boolean(source?.title && source.type && source.note && source.lastReviewedAt && source.useFor.length);
      });

      const authoritiesResolve = rule.authorityIds.every((authorityId) => {
        const authority = getEvidenceAuthority(authorityId);
        return Boolean(authority?.name && authority.useFor.length && authority.notUseFor.length && authority.caveat);
      });

      const heuristicHasBoundary = rule.implementationType !== 'product_heuristic' || Boolean(rule.caveat);
      return hasRequiredFields && sourcesResolve && authoritiesResolve && heuristicHasBoundary;
    })
  );
};

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
