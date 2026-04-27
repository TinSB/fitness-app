import { describe, expect, it } from 'vitest';
import { EVIDENCE_AUTHORITIES } from '../src/content/evidenceAuthorities';
import { validateEvidenceRuleAuthorityUsage } from '../src/content/evidenceGovernance';
import type { EvidenceRule } from '../src/content/evidenceRules';
import { EVIDENCE_RULES } from '../src/content/evidenceRules';

const baseRule: EvidenceRule = {
  id: 'progressive_overload',
  title: '渐进超负荷',
  label: '渐进超负荷',
  practicalSummary: '测试规则',
  appliesTo: ['训练处方'],
  sourceIds: ['acsm_resistance_training_guidance'],
  authorityIds: ['acsm'],
  implementationType: 'direct_guideline',
  evidenceTier: 'A',
  confidence: 'high',
  caveat: '测试边界',
};

describe('evidence governance validation', () => {
  it('current evidence rules do not have governance errors', () => {
    const issues = validateEvidenceRuleAuthorityUsage(EVIDENCE_RULES, EVIDENCE_AUTHORITIES);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('detects market data attached to training prescription rules', () => {
    const issues = validateEvidenceRuleAuthorityUsage(
      [{ ...baseRule, authorityIds: ['health_fitness_association_sfia'] }],
      EVIDENCE_AUTHORITIES,
    );

    expect(issues.some((issue) => issue.severity === 'error' && issue.authorityId === 'health_fitness_association_sfia')).toBe(true);
  });

  it('detects population datasets attached to direct load prescription rules', () => {
    const issues = validateEvidenceRuleAuthorityUsage([{ ...baseRule, authorityIds: ['nhanes'] }], EVIDENCE_AUTHORITIES);

    expect(issues.some((issue) => issue.severity === 'error' && issue.authorityId === 'nhanes')).toBe(true);
  });

  it('warns when public health guidance is the only source for specialty hypertrophy rules', () => {
    const issues = validateEvidenceRuleAuthorityUsage(
      [{ ...baseRule, id: 'weekly_volume_distribution', authorityIds: ['hhs_paga'] }],
      EVIDENCE_AUTHORITIES,
    );

    expect(issues.some((issue) => issue.severity === 'warning' && issue.authorityId === 'hhs_paga')).toBe(true);
  });
});
