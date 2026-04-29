import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildRecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { RecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import type { ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeAppData, templates } from './fixtures';

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

const lowReadiness: ReadinessResult = {
  score: 35,
  level: 'low',
  trainingAdjustment: 'recovery',
  reasons: ['准备度偏低'],
};

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
        title: '今日建议：上肢 A（保守版）',
        summary: '今天肩部酸痛，上肢 A 建议保守执行。',
        conflictLevel: 'moderate',
      },
    });

    expect(viewModel.currentTrainingName).toContain('保守版');
    expect(viewModel.primaryActionLabel).toBe('开始保守训练');
    expect(viewModel.requiresRecoveryOverride).toBe(true);
  });

  it('shows Legs A conservative version for back soreness instead of recovery-only', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['背部'],
    });
    const viewModel = buildTodayViewModel({
      todayState: { ...notStartedState, plannedTemplateId: 'legs-a' },
      selectedTemplate: getTemplate('legs-a'),
      nextSuggestion: getTemplate('legs-a'),
      recoveryRecommendation: recommendation,
    });

    expect(recommendation.kind).toBe('modified_train');
    expect(viewModel.currentTrainingName).toBe('腿 A（保守版）');
    expect(viewModel.primaryActionLabel).toBe('开始保守训练');
    expect(viewModel.secondaryActionLabels).toContain('仍按原计划训练');
  });

  it('shows rest or active recovery for high conflict with low readiness', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: ['肩部'],
      readinessResult: lowReadiness,
    });
    const viewModel = buildTodayViewModel({
      todayState: notStartedState,
      selectedTemplate: getTemplate('upper'),
      nextSuggestion: getTemplate('upper'),
      recoveryRecommendation: recommendation,
    });

    expect(['rest', 'active_recovery']).toContain(viewModel.recommendationKind);
    expect(viewModel.currentTrainingName === '休息' || viewModel.currentTrainingName === '主动恢复').toBe(true);
    expect(viewModel.primaryActionLabel === '查看恢复建议' || viewModel.primaryActionLabel === '查看恢复安排').toBe(true);
  });

  it('does not render start-training as the primary rest-state copy', () => {
    const data = makeAppData({
      selectedTemplateId: 'upper',
      todayStatus: { sleep: '一般', energy: '低', time: '60', soreness: ['肩'] },
    });
    const node = React.createElement(TodayView, {
        data,
        selectedTemplate: getTemplate('upper'),
        suggestedTemplate: getTemplate('upper'),
        weeklyPrescription: buildWeeklyPrescription(data),
        recoveryRecommendation: restRecommendation,
        trainingMode: 'hybrid',
        onModeChange: noop,
        onStatusChange: noop,
        onSorenessToggle: noop,
        onTemplateSelect: noop,
        onUseSuggestion: noop,
        onStart: noop,
        onResume: noop,
      });
    const markup = renderToStaticMarkup(node);
    const text = visibleText(node);

    expect(text).toContain('查看恢复建议');
    expect(text).toContain('仍要训练');
    expect(markup).not.toContain('>开始训练<');
  });

  it('wires TodayView override through ConfirmDialog copy', () => {
    const source = readFileSync('src/features/TodayView.tsx', 'utf8');

    expect(source).toContain('今天存在恢复冲突，确定继续训练吗？');
    expect(source).toContain('仍要训练');
    expect(source).toContain('仍按原计划训练');
    expect(source).toContain('recoveryNeedsNonTrainingPrimary');
  });

  it('keeps recovery recommendation copy localized', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['背部'],
    });
    const viewModel = buildTodayViewModel({
      todayState: { ...notStartedState, plannedTemplateId: 'legs-a' },
      selectedTemplate: getTemplate('legs-a'),
      nextSuggestion: getTemplate('legs-a'),
      recoveryRecommendation: recommendation,
    });
    const text = [
      viewModel.currentTrainingName,
      viewModel.primaryActionLabel,
      viewModel.decisionText,
      ...(viewModel.recoveryReasons || []),
    ].join('\n');

    expect(text).toMatch(/[一-龥]/);
    expect(text).not.toMatch(/\b(undefined|null|modified_train|active_recovery|reduce_volume|reduce_intensity|high|moderate|low|none)\b/);
  });
});
