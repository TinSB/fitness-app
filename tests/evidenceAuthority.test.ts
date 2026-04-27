import { describe, expect, it } from 'vitest';
import { EVIDENCE_AUTHORITIES } from '../src/content/evidenceAuthorities';

describe('evidence authorities', () => {
  it('each authority has explicit use and non-use boundaries', () => {
    expect(EVIDENCE_AUTHORITIES.length).toBeGreaterThanOrEqual(9);
    EVIDENCE_AUTHORITIES.forEach((authority) => {
      expect(authority.id).toBeTruthy();
      expect(authority.name).toBeTruthy();
      expect(authority.category).toMatch(
        /exercise_prescription|strength_conditioning|public_health_guideline|population_dataset|nutrition|industry_market/,
      );
      expect(authority.authorityLevel).toMatch(/highest|high|professional_standard|contextual|market_only/);
      expect(authority.sourceType).toMatch(/guideline|position_stand|systematic_review|national_survey|textbook|market_report/);
      expect(authority.useFor.length).toBeGreaterThan(0);
      expect(authority.notUseFor.length).toBeGreaterThan(0);
      expect(authority.caveat).toBeTruthy();
    });
  });

  it('market-only authorities cannot be used for training prescription', () => {
    const market = EVIDENCE_AUTHORITIES.find((authority) => authority.authorityLevel === 'market_only');
    expect(market).toBeTruthy();
    expect(market?.category).toBe('industry_market');
    expect(market?.notUseFor.join(' ')).toMatch(/训练处方|训练重量|有效组|RIR/);
  });

  it('population datasets are contextual only', () => {
    const datasets = EVIDENCE_AUTHORITIES.filter((authority) => authority.category === 'population_dataset');
    expect(datasets.length).toBeGreaterThanOrEqual(4);
    datasets.forEach((authority) => {
      expect(authority.authorityLevel).toBe('contextual');
      expect(authority.notUseFor.join(' ')).toMatch(/训练|重量|处方|效果/);
    });
  });
});
