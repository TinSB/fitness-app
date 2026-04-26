import { describe, expect, it } from 'vitest';
import {
  explainAdjustmentDefaultSelection,
  explainAdjustmentRisk,
  explainAdjustmentReview,
  explainExperimentalTemplatePolicy,
} from '../src/engines/explainabilityEngine';

describe('adjustment workflow explainability', () => {
  it('explains selection, experimental template policy, risk and review without raw enum leakage', () => {
    const selectedText = explainAdjustmentDefaultSelection({
      id: 'volume-back',
      priority: 'high',
      category: 'volume',
      targetType: 'muscle',
      targetLabel: '背部',
      issue: '背部不足',
      recommendation: '下周补 2 组背部训练量。',
      reason: '加权有效组低于目标。',
      suggestedChange: { muscleId: 'back', setsDelta: 2 },
      confidence: 'high',
    });
    const policyText = explainExperimentalTemplatePolicy();
    const riskText = explainAdjustmentRisk({
      changeId: 'change-1',
      type: 'swap_exercise',
      label: '替代动作',
      before: '卧推',
      after: '需要人工选择安全替代动作',
      reason: '近期有不适信号。',
      riskLevel: 'high',
    });
    const reviewText = explainAdjustmentReview({
      historyItemId: 'history-1',
      status: 'worse',
      summary: '实验模板后完成度下降。',
      metrics: { adherenceChange: -20 },
      recommendation: 'review_manually',
    });

    const text = [selectedText, policyText, riskText, reviewText].join(' ');
    expect(text).toContain('实验模板');
    expect(text).toContain('回滚');
    expect(text).not.toMatch(/undefined|null|swap_exercise/);
  });
});
