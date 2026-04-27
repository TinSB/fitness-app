import { describe, expect, it } from 'vitest';
import {
  buildEvidenceRuleExplanation,
  formatEvidenceSourceBoundary,
  formatExplanationEvidence,
} from '../../src/engines/explainability';
import type { ExplanationItem } from '../../src/models/training-model';
import { expectCleanExplanation } from './testUtils';

describe('evidence explainability module', () => {
  it('shows a Chinese evidence rule label and boundary', () => {
    const text = buildEvidenceRuleExplanation('weekly_volume_distribution');

    expect(text).toContain('：');
    expect(text).toContain('依据');
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
});
