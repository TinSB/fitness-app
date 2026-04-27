import { describe, expect, it } from 'vitest';
import {
  explainAddNewExerciseDecision,
  explainAdjustmentDraftStale,
  explainAdjustmentRollbackDecision,
  explainSupportAdjustmentChange,
} from '../../src/engines/explainability';
import { expectCleanExplanation } from './testUtils';

describe('adjustment explainability module', () => {
  it('explains why add_new_exercise uses a new slot instead of more sets', () => {
    const text = explainAddNewExerciseDecision({
      exerciseName: 'Lat Pulldown',
      dayTemplateName: 'Pull A',
      existingExerciseName: 'Seated Row',
    });

    expect(text).toContain('Lat Pulldown');
    expect(text).toContain('Pull A');
    expectCleanExplanation(text);
  });

  it('explains stale draft protection', () => {
    const text = explainAdjustmentDraftStale();
    expect(text).toContain('旧预览');
    expect(text).toContain('重新生成');
    expectCleanExplanation(text);
  });

  it('explains support adjustment and rollback', () => {
    const supportText = explainSupportAdjustmentChange({
      type: 'increase_support',
      summaryBefore: '纠偏 moderate / 功能 standard',
      summaryAfter: '纠偏 aggressive / 功能 enhanced',
    });
    const rollbackText = explainAdjustmentRollbackDecision('实验模板后的疼痛信号升高。');

    expect(supportText).toContain('support');
    expect(rollbackText).toContain('回滚');
    expectCleanExplanation(`${supportText} ${rollbackText}`);
  });
});
