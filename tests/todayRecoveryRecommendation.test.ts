import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { RecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import { getTemplate } from './fixtures';

const notStartedState = {
  status: 'not_started' as const,
  date: '2026-04-29',
  plannedTemplateId: 'upper',
};

const restRecommendation: RecoveryAwareRecommendation = {
  kind: 'rest',
  title: '今日建议：休息',
  summary: '今天肩部酸痛与上肢训练冲突较高，建议休息。',
  conflictLevel: 'high',
  affectedAreas: ['肩部'],
  reasons: ['上肢 A 包含较多肩部参与动作。'],
  suggestedChanges: [{ type: 'rest', reason: '今天保留恢复空间。' }],
  requiresConfirmationToOverride: true,
};

describe('Today recovery recommendation', () => {
  it('supports rest as a legal Today recommendation without start-training as primary CTA', () => {
    const viewModel = buildTodayViewModel({
      todayState: notStartedState,
      selectedTemplate: getTemplate('upper'),
      nextSuggestion: getTemplate('upper'),
      recoveryRecommendation: restRecommendation,
    });

    expect(viewModel.recommendationKind).toBe('rest');
    expect(viewModel.currentTrainingName).toContain('休息');
    expect(viewModel.primaryActionLabel).toBe('查看恢复建议');
    expect(viewModel.primaryActionLabel).not.toContain('开始训练');
    expect(viewModel.requiresRecoveryOverride).toBe(true);
  });

  it('supports modified_train copy for conservative training', () => {
    const viewModel = buildTodayViewModel({
      todayState: notStartedState,
      selectedTemplate: getTemplate('upper'),
      nextSuggestion: getTemplate('upper'),
      recoveryRecommendation: {
        ...restRecommendation,
        kind: 'modified_train',
        templateId: 'upper',
        templateName: '上肢 A',
        title: '今日建议：上肢 A（保守建议）',
        summary: '今天肩部酸痛，上肢 A 建议保守执行。',
        conflictLevel: 'moderate',
      },
    });

    expect(viewModel.currentTrainingName).toContain('保守');
    expect(viewModel.primaryActionLabel).toBe('查看保守建议');
    expect(viewModel.requiresRecoveryOverride).toBe(true);
  });

  it('wires TodayView override through ConfirmDialog copy', () => {
    const source = readFileSync('src/features/TodayView.tsx', 'utf8');

    expect(source).toContain('今天存在恢复冲突，确定继续训练吗？');
    expect(source).toContain('仍要训练');
    expect(source).toContain('recoveryNeedsNonTrainingPrimary');
  });
});
