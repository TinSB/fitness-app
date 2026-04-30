import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import { dedupeCoachReminders } from '../src/presenters/coachReminderPresenter';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import type { RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('visual text guard', () => {
  it('presenter text does not emit undefined, null, or raw state labels', () => {
    const vm = buildTodayViewModel({
      todayState: {
        status: 'not_started',
        date: '2026-04-27',
        plannedTemplateId: 'push-a',
        primaryAction: 'start_training',
      },
      selectedTemplate: getTemplate('push-a'),
    });
    const text = [vm.pageTitle, vm.recommendationLabel, vm.primaryActionLabel, vm.statusText, ...vm.secondaryActionLabels].join(' ');

    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('not_started');
  });

  it('recommendation explanation text does not emit raw technical labels', () => {
    const trace: RecommendationTrace = {
      sessionTemplateId: 'push-a',
      primaryGoal: 'hypertrophy',
      trainingMode: 'hybrid',
      trainingLevel: 'medium',
      globalFactors: [
        {
          id: 'raw-factor',
          label: 'primaryGoal',
          effect: 'decrease',
          magnitude: 'large',
          source: 'primaryGoal',
          reason: 'primaryGoal decrease high，因为目标不同，建议保守。 medium low undefined null',
        },
      ],
      exerciseFactors: {},
      volumeFactors: [],
      loadFeedbackFactors: [],
      finalSummary: 'trainingMode maintain 当前建议保持克制。',
    };
    const vm = buildRecommendationExplanationViewModel(trace);
    const text = [vm.summary, ...vm.primaryFactors.flatMap((item) => [item.label, item.effectLabel, item.reason])].join(' ');

    expect(text).not.toMatch(/\b(increase|decrease|primaryGoal|trainingMode|high|medium|low|undefined|null)\b/);
    expect(text).toContain('主目标');
    expect(text).toContain('保守建议');
  });

  it('data health default UI copy does not emit engineering terms', () => {
    const vm = buildDataHealthViewModel({
      status: 'has_errors',
      summary: 'synthetic replacement id detected',
      issues: [
        {
          id: 'synthetic-replacement-session-1-0-actualExerciseId',
          severity: 'error',
          category: 'replacement',
          title: 'synthetic replacement id detected',
          message: 'actualExerciseId missing undefined null',
          canAutoFix: false,
        },
      ],
    });
    const text = [
      vm.statusLabel,
      vm.summary,
      ...vm.primaryIssues.flatMap((issue) => [issue.title, issue.userMessage, issue.severityLabel, issue.action?.label || '']),
    ].join(' ');

    expect(text).toContain('替代动作记录异常');
    expect(text).not.toMatch(/synthetic replacement id|actualExerciseId|undefined|null|has_errors|replacement|actionLabel/);
  });

  it('coach reminders remove duplicate recovery noise and raw labels', () => {
    const reminders = dedupeCoachReminders([
      {
        id: 'recovery',
        title: '恢复提醒',
        message: '今天标记胸/背酸痛，建议保持保守。',
        tone: 'warning',
        source: 'dailyAdjustment',
        priority: 60,
      },
      {
        id: 'another-recovery',
        title: '恢复冲突',
        message: '今天标记胸/背酸痛，recovery modified_train high medium low undefined null',
        tone: 'warning',
        source: 'recovery',
        priority: 80,
      },
    ]);
    const text = reminders.flatMap((item) => [item.title, item.message]).join(' ');

    expect(reminders).toHaveLength(1);
    expect(text).toContain('胸/背酸痛');
    expect(text).not.toMatch(/\b(modified_train|active_recovery|high|medium|low|undefined|null)\b/);
  });

  it('Plan page text uses the final section names without old entry copy', () => {
    const data = makeAppData();
    const text = visibleText(
      renderToStaticMarkup(
        React.createElement(PlanView, {
          data,
          weeklyPrescription: buildWeeklyPrescription(data),
          coachActions: [],
          selectedTemplateId: data.selectedTemplateId,
          onSelectTemplate: noop,
          onStartTemplate: noop,
          onUpdateExercise: noop,
          onResetTemplates: noop,
          onCoachAction: noop,
          onDismissCoachAction: noop,
        }),
      ),
    );

    expect(text).toContain('当前计划');
    expect(text).toContain('本周安排');
    expect(text).toContain('待处理建议');
    expect(text).toContain('调整草案');
    expect(text).not.toContain('本周训练日');
    expect(text).not.toContain('训练日模板');
    expect(text).not.toContain('Progress');
    expect(text).not.toContain('进度页');
    expect(text).not.toMatch(/\b(undefined|null|hybrid|hypertrophy|strength|fat_loss|warmup|working|support|compound|isolation|machine|review_volume|create_plan_adjustment_preview|push-a|pull-a|legs-a)\b/);
  });
});
