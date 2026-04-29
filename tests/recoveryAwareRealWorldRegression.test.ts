import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import {
  buildRecoveryAwareRecommendation,
  buildTemplateRecoveryConflict,
  type RecoveryAwareRecommendation,
} from '../src/engines/recoveryAwareScheduler';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import type { ReadinessResult } from '../src/models/training-model';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { getTemplate, makeAppData, templates } from './fixtures';

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

const assertNoUnsafeVisibleText = (text: string) => {
  expect(text).not.toMatch(
    /\b(modified_train|active_recovery|mobility_only|reduce_volume|reduce_intensity|substitute|skip_accessory|choose_alternative_template|high|moderate|low|none|undefined|null)\b/,
  );
  expect(text).not.toMatch(/医疗诊断|诊断|疾病|治疗|严重受伤/);
};

const renderToday = ({
  templateId,
  recoveryRecommendation,
  coachAutomationSummary,
}: {
  templateId: string;
  recoveryRecommendation: RecoveryAwareRecommendation;
  coachAutomationSummary?: CoachAutomationSummary;
}) => {
  const data = makeAppData({
    selectedTemplateId: templateId,
    todayStatus: { sleep: '一般', energy: '中', time: '60', soreness: ['背'] },
  });

  return visibleText(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate(templateId),
      suggestedTemplate: getTemplate(templateId),
      weeklyPrescription: buildWeeklyPrescription(data),
      recoveryRecommendation,
      coachAutomationSummary,
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
    }),
  );
};

describe('recovery-aware real-world regression', () => {
  it('keeps back soreness plus Legs A as conservative Legs A with exercise-level guidance', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['背部'],
    });
    const text = renderToday({ templateId: 'legs-a', recoveryRecommendation: recommendation });

    expect(recommendation.kind).toBe('modified_train');
    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.kind).not.toBe('active_recovery');
    expect(recommendation.templateRecoveryConflict?.conflictingExercises.map((exercise) => exercise.exerciseId)).toContain('romanian-deadlift');
    expect(recommendation.templateRecoveryConflict?.safeExercises.map((exercise) => exercise.exerciseId)).toEqual(
      expect.arrayContaining(['leg-press', 'leg-curl', 'calf-raise']),
    );
    expect(recommendation.templateRecoveryConflict?.suggestedChanges).toEqual(
      expect.arrayContaining([expect.objectContaining({ exerciseId: 'romanian-deadlift', type: 'substitute' })]),
    );
    expect(text).toContain('腿 A（保守版）');
    expect(text).toMatch(/罗马尼亚硬拉[\s\S]*建议替代/);
    expect(text).toMatch(/腿举[\s\S]*可保留/);
    expect(text).toMatch(/腿弯举[\s\S]*可保留/);
    expect(text).toMatch(/提踵[\s\S]*可保留/);
    assertNoUnsafeVisibleText(text);
  });

  it('treats leg soreness plus Legs A as high conflict and avoids normal same-template training', () => {
    const conflict = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['腿部'],
    });
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['腿部'],
    });

    expect(conflict.conflictLevel).toBe('high');
    expect(conflict.conflictingExercises.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.kind === 'train' && recommendation.templateId === 'legs-a').toBe(false);
    expect(recommendation.reasons.length).toBeGreaterThan(0);
  });

  it('explains shoulder soreness plus Upper instead of silently allowing high-conflict upper training', () => {
    const conflict = buildTemplateRecoveryConflict({
      template: getTemplate('upper'),
      sorenessAreas: ['肩部'],
    });
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: ['肩部'],
    });

    expect(['moderate', 'high']).toContain(conflict.conflictLevel);
    expect(conflict.conflictingExercises.map((exercise) => exercise.exerciseId)).toContain('shoulder-press');
    expect(recommendation.kind === 'train' && recommendation.templateId === 'upper' && recommendation.conflictLevel !== 'low').toBe(false);
    expect(recommendation.reasons.join('\n')).not.toHaveLength(0);
  });

  it('marks push exercises for chest soreness plus Push A', () => {
    const conflict = buildTemplateRecoveryConflict({
      template: getTemplate('push-a'),
      sorenessAreas: ['胸部'],
    });

    expect(['moderate', 'high']).toContain(conflict.conflictLevel);
    expect(conflict.conflictingExercises.map((exercise) => exercise.exerciseId)).toEqual(
      expect.arrayContaining(['bench-press', 'incline-db-press', 'machine-chest-press']),
    );
    expect(conflict.summary).toMatch(/[一-龥]/);
  });

  it('recommends rest or active recovery when multiple soreness areas meet low readiness', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: ['肩部', '胸部', '背部'],
      readinessResult: lowReadiness,
    });

    expect(['rest', 'active_recovery']).toContain(recommendation.kind);
    expect(recommendation.requiresConfirmationToOverride).toBe(true);
    expect(recommendation.suggestedChanges.some((change) => change.type === 'rest')).toBe(true);
  });

  it('requires confirmation for override and does not mutate the original template', () => {
    const template = getTemplate('legs-a');
    const before = JSON.stringify(template);
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: template,
      templates,
      sorenessAreas: ['背部'],
    });
    const viewModel = buildTodayViewModel({
      todayState: { status: 'not_started', date: '2026-04-29', plannedTemplateId: 'legs-a' },
      selectedTemplate: template,
      nextSuggestion: template,
      recoveryRecommendation: recommendation,
    });
    const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');

    expect(viewModel.requiresRecoveryOverride).toBe(true);
    expect(viewModel.secondaryActionLabels).toContain('仍按原计划训练');
    expect(todaySource).toContain('今天存在恢复冲突，确定继续训练吗？');
    expect(todaySource).toContain('ConfirmDialogHost');
    expect(JSON.stringify(template)).toBe(before);
  });

  it('deduplicates Today soreness reminders from automation sources', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['背部'],
    });
    const coachAutomationSummary: CoachAutomationSummary = {
      keyWarnings: ['今天标记背部酸痛，建议降低相关动作压力。'],
      recommendedActions: [
        {
          id: 'daily-adjustment-back-soreness',
          label: '今日自动调整',
          actionType: 'apply_daily_adjustment',
          reason: '今天标记背部酸痛，建议降低相关动作压力。',
          requiresConfirmation: true,
        },
      ],
    };
    const text = renderToday({ templateId: 'legs-a', recoveryRecommendation: recommendation, coachAutomationSummary });

    expect(text).toContain('教练提醒');
    expect(text.match(/今天标记背部酸痛，建议降低相关动作压力。/g)).toHaveLength(1);
  });

  it('keeps recovery explanation concise, localized, and non-diagnostic', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates,
      sorenessAreas: ['背部'],
    });
    const viewModel = buildRecommendationExplanationViewModel(null, { recoveryRecommendation: recommendation });
    const text = [
      viewModel.summary,
      ...viewModel.primaryFactors.flatMap((factor) => [factor.label, factor.effectLabel, factor.reason]),
      ...viewModel.secondaryFactors.flatMap((factor) => [factor.label, factor.effectLabel, factor.reason]),
    ].join('\n');

    expect(text).toContain('背部酸痛或恢复信号');
    expect(text).toContain('罗马尼亚硬拉');
    expect(text).toContain('腿举');
    expect(text).toContain('腿 A（保守版）');
    expect(text.match(/罗马尼亚硬拉/g)).toHaveLength(1);
    assertNoUnsafeVisibleText(text);
  });
});
