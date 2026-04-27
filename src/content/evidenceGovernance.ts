import type { EvidenceAuthority } from './evidenceAuthorities';
import type { EvidenceRule } from './evidenceRules';

export type EvidenceGovernanceIssue = {
  ruleId: string;
  authorityId: string;
  severity: 'error' | 'warning';
  message: string;
};

const TRAINING_PRESCRIPTION_RULE_IDS = new Set([
  'weekly_volume_distribution',
  'hypertrophy_rep_range',
  'strength_rep_range',
  'rir_effort_control',
  'progressive_overload',
  'deload_volume_reduction',
  'technique_quality_gate',
  'pain_conservative_rule',
  'e1rm_estimation',
  'effective_set_estimation',
  'muscle_contribution_weighting',
  'readiness_score',
  'warmup_policy',
  'auto_training_level_assessment',
  'baseline_building',
  'level_gated_progression',
  'level_gated_exercise_complexity',
  'rest_interval_compound',
  'rest_interval_isolation',
]);

const SPECIALTY_TRAINING_RULE_IDS = new Set([
  'weekly_volume_distribution',
  'hypertrophy_rep_range',
  'strength_rep_range',
  'rir_effort_control',
  'progressive_overload',
  'deload_volume_reduction',
  'effective_set_estimation',
]);

export const validateEvidenceRuleAuthorityUsage = (
  rules: EvidenceRule[],
  authorities: EvidenceAuthority[],
): EvidenceGovernanceIssue[] => {
  const authorityMap = new Map(authorities.map((authority) => [authority.id, authority]));
  const issues: EvidenceGovernanceIssue[] = [];

  rules.forEach((rule) => {
    const linkedAuthorities = rule.authorityIds.map((id) => authorityMap.get(id)).filter(Boolean) as EvidenceAuthority[];

    rule.authorityIds.forEach((authorityId) => {
      const authority = authorityMap.get(authorityId);
      if (!authority) {
        issues.push({
          ruleId: rule.id,
          authorityId,
          severity: 'error',
          message: '证据规则引用了不存在的权威来源。',
        });
        return;
      }

      if (
        TRAINING_PRESCRIPTION_RULE_IDS.has(rule.id) &&
        (authority.category === 'industry_market' || authority.authorityLevel === 'market_only')
      ) {
        issues.push({
          ruleId: rule.id,
          authorityId,
          severity: 'error',
          message: '行业市场来源不得用于训练处方、RIR、e1RM、有效组或疼痛处理规则。',
        });
      }

      if (TRAINING_PRESCRIPTION_RULE_IDS.has(rule.id) && authority.category === 'population_dataset') {
        issues.push({
          ruleId: rule.id,
          authorityId,
          severity: 'error',
          message: '人群数据只能用于背景参考，不得直接用于个人动作、重量或组数处方。',
        });
      }
    });

    const hasTrainingAuthority = linkedAuthorities.some((authority) =>
      ['exercise_prescription', 'strength_conditioning'].includes(authority.category),
    );
    const hasOnlyPublicHealthAuthorities =
      linkedAuthorities.length > 0 && linkedAuthorities.every((authority) => authority.category === 'public_health_guideline');

    if (SPECIALTY_TRAINING_RULE_IDS.has(rule.id) && hasOnlyPublicHealthAuthorities && !hasTrainingAuthority) {
      issues.push({
        ruleId: rule.id,
        authorityId: linkedAuthorities[0]?.id || 'unknown',
        severity: 'warning',
        message: '公共健康指南可以支持健康底线，但不能单独决定肌肥大或力量专项处方。',
      });
    }
  });

  return issues;
};
