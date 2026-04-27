import { describe, expect, it } from 'vitest';
import {
  explainAddNewExerciseDecision,
  explainAdjustmentDefaultSelection,
  explainAdjustmentDraftStale,
  explainAdjustmentReview,
  explainAdjustmentRollbackDecision,
  explainAdjustmentRisk,
  explainAdjustmentTooEarly,
  explainExperimentalTemplatePolicy,
  explainSupportAdjustmentChange,
} from '../src/engines/explainabilityEngine';

describe('adjustment workflow explainability', () => {
  it('explains stale draft, add_new_exercise, support adjustment and rollback without leaking enums', () => {
    const selectedText = explainAdjustmentDefaultSelection({
      id: 'volume-back',
      priority: 'high',
      category: 'volume',
      targetType: 'muscle',
      targetLabel: 'Back',
      issue: 'Back volume is below target',
      recommendation: 'Add two back sets next week',
      reason: 'Weighted effective sets are below target',
      suggestedChange: { muscleId: 'back', setsDelta: 2 },
      confidence: 'high',
    });
    const policyText = explainExperimentalTemplatePolicy();
    const addExerciseText = explainAddNewExerciseDecision({
      exerciseName: 'Lat Pulldown',
      dayTemplateName: 'Pull A',
      existingExerciseName: 'Seated Row',
    });
    const supportText = explainSupportAdjustmentChange({
      type: 'reduce_support',
      summaryBefore: 'Correction aggressive / Functional enhanced',
      summaryAfter: 'Correction moderate / Functional standard',
    });
    const staleText = explainAdjustmentDraftStale();
    const rollbackText = explainAdjustmentRollbackDecision('Shoulder discomfort and completion quality both fell after the experiment.');
    const reviewText = explainAdjustmentReview({
      historyItemId: 'history-1',
      status: 'worse',
      confidence: 'medium',
      summary: 'Completion quality fell after the experimental template.',
      metrics: { adherenceChange: -20 },
      recommendation: 'review_manually',
    });

    const text = [selectedText, policyText, addExerciseText, supportText, staleText, rollbackText, reviewText].join(' ');
    expect(text).toContain('实验模板');
    expect(text).toContain('回滚');
    expect(text).not.toMatch(/undefined|null|add_new_exercise|reduce_support|review_manually/);
  });

  it('explains why review is too early and why a change is high risk', () => {
    const tooEarlyText = explainAdjustmentTooEarly();
    const riskText = explainAdjustmentRisk({
      changeId: 'change-1',
      type: 'add_new_exercise',
      label: '新增动作',
      before: 'Pull A does not have Lat Pulldown yet',
      after: 'Need manual day selection',
      reason: 'The system cannot safely auto-place this change yet.',
      riskLevel: 'high',
    });

    expect(`${tooEarlyText} ${riskText}`).not.toMatch(/undefined|null|\bhigh\b/);
    expect(tooEarlyText).toContain('太早');
    expect(riskText).toContain('风险');
  });
});
