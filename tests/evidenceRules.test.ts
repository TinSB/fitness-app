import { describe, expect, it } from 'vitest';
import { getEvidenceAuthority } from '../src/content/evidenceAuthorities';
import { EVIDENCE_RULES, validateEvidenceRules } from '../src/content/evidenceRules';
import { getEvidenceSource } from '../src/content/evidenceSources';

describe('structured evidence rules', () => {
  it('each rule has a practical summary, confidence, tier and implementation type', () => {
    expect(EVIDENCE_RULES.length).toBeGreaterThanOrEqual(14);
    EVIDENCE_RULES.forEach((rule) => {
      expect(rule.label).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(rule.practicalSummary).toBeTruthy();
      expect(rule.confidence).toMatch(/high|moderate|low/);
      expect(rule.evidenceTier).toMatch(/A|B|C/);
      expect(rule.implementationType).toMatch(/direct_guideline|research_supported|product_heuristic/);
      expect(rule.caveat).toBeTruthy();
      expect(rule.sourceIds.length).toBeGreaterThan(0);
      expect(rule.authorityIds.length).toBeGreaterThan(0);
    });
  });

  it('all source and authority ids resolve to auditable descriptions', () => {
    EVIDENCE_RULES.forEach((rule) => {
      rule.sourceIds.forEach((sourceId) => {
        const source = getEvidenceSource(sourceId);
        expect(source).toBeTruthy();
        expect(source?.title).toBeTruthy();
        expect(source?.type).toMatch(
          /position_stand|systematic_review|guideline|textbook|expert_consensus|national_survey|market_report/,
        );
        expect(source?.note).toBeTruthy();
        expect(source?.useFor.length).toBeGreaterThan(0);
        expect(source?.lastReviewedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
      });

      rule.authorityIds.forEach((authorityId) => {
        const authority = getEvidenceAuthority(authorityId);
        expect(authority).toBeTruthy();
        expect(authority?.useFor.length).toBeGreaterThan(0);
        expect(authority?.notUseFor.length).toBeGreaterThan(0);
        expect(authority?.caveat).toBeTruthy();
      });
    });
    expect(validateEvidenceRules()).toBe(true);
  });

  it('product heuristics explicitly disclose their boundary', () => {
    EVIDENCE_RULES.filter((rule) => rule.implementationType === 'product_heuristic').forEach((rule) => {
      expect(rule.evidenceTier).toBe('C');
      expect(rule.caveat).toMatch(/估算|不是|产品化|内部|用户/);
    });
  });
});
