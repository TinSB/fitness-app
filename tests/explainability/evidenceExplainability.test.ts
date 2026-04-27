import { describe, expect, it } from 'vitest';
import {
  buildEvidenceRuleExplanation,
  formatAuthorityLevelLabel,
  formatEvidenceImplementationTypeLabel,
  formatEvidenceSourceBoundary,
  formatEvidenceTierLabel,
  formatExplanationEvidence,
} from '../../src/engines/explainability';
import type { ExplanationItem } from '../../src/models/training-model';
import { expectCleanExplanation } from './testUtils';

describe('evidence explainability module', () => {
  it('shows a Chinese evidence rule label, tier and boundary', () => {
    const text = buildEvidenceRuleExplanation('weekly_volume_distribution');

    expect(text).toContain('：');
    expect(text).toContain('依据');
    expect(text).toContain('研究支持规则');
    expect(formatEvidenceSourceBoundary('weekly_volume_distribution')).toBeTruthy();
    expectCleanExplanation(text);
  });

  it('formats evidence labels from explanation items', () => {
    const item: ExplanationItem = {
      title: 'Evidence',
      conclusion: 'Use weekly volume budget',
      reason: 'Target muscle is below budget',
      action: 'Adjust next week',
      evidenceRuleIds: ['weekly_volume_distribution'],
      confidence: 'moderate',
    };

    const labels = formatExplanationEvidence(item);
    expect(labels.length).toBe(1);
    expect(labels[0]).toBeTruthy();
  });

  it('formats governance enums as Chinese copy', () => {
    expect(formatEvidenceTierLabel('A')).toBe('直接权威依据');
    expect(formatEvidenceTierLabel('B')).toBe('研究支持规则');
    expect(formatEvidenceTierLabel('C')).toBe('产品化辅助规则');
    expect(formatEvidenceImplementationTypeLabel('direct_guideline')).toBe('指南直接支持');
    expect(formatEvidenceImplementationTypeLabel('research_supported')).toBe('研究支持');
    expect(formatEvidenceImplementationTypeLabel('product_heuristic')).toBe('产品化估算');
    expect(formatAuthorityLevelLabel('highest')).toBe('最高权威');
    expect(formatAuthorityLevelLabel('market_only')).toBe('行业市场参考');
  });

  it('does not expose raw enum or empty text in evidence copy', () => {
    const texts = [
      buildEvidenceRuleExplanation('health_baseline_activity'),
      formatEvidenceTierLabel('C'),
      formatEvidenceImplementationTypeLabel('product_heuristic'),
      formatAuthorityLevelLabel('contextual'),
    ];

    texts.forEach((text) => {
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\b(undefined|null)\b/);
      expect(text).not.toMatch(/\b(direct_guideline|research_supported|product_heuristic|highest|market_only)\b/);
    });
  });
});
