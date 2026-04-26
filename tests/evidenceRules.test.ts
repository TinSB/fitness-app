import { describe, expect, it } from 'vitest';
import { EVIDENCE_RULES, validateEvidenceRules } from '../src/content/evidenceRules';
import { getEvidenceSource } from '../src/content/evidenceSources';

describe('structured evidence rules', () => {
  it('each rule has a practical summary, confidence and caveat', () => {
    expect(EVIDENCE_RULES.length).toBeGreaterThanOrEqual(10);
    EVIDENCE_RULES.forEach((rule) => {
      expect(rule.label).toBeTruthy();
      expect(rule.practicalSummary).toBeTruthy();
      expect(rule.confidence).toMatch(/high|moderate|low/);
      expect(rule.caveat).toBeTruthy();
      expect(rule.sourceIds.length).toBeGreaterThan(0);
    });
  });

  it('all source ids resolve to auditable evidence source descriptions', () => {
    EVIDENCE_RULES.forEach((rule) => {
      rule.sourceIds.forEach((sourceId) => {
        const source = getEvidenceSource(sourceId);
        expect(source).toBeTruthy();
        expect(source?.title).toBeTruthy();
        expect(source?.type).toMatch(/position_stand|systematic_review|guideline|textbook|expert_consensus/);
        expect(source?.note).toBeTruthy();
        expect(source?.useFor.length).toBeGreaterThan(0);
        expect(source?.lastReviewedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
      });
    });
    expect(validateEvidenceRules()).toBe(true);
  });
});
