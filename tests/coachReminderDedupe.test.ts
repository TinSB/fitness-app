import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { dedupeCoachReminders, splitCoachReminders, type CoachReminderView } from '../src/presenters/coachReminderPresenter';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const reminder = (overrides: Partial<CoachReminderView>): CoachReminderView => ({
  id: 'reminder',
  title: '教练提醒',
  message: '今天保持正常训练。',
  tone: 'info',
  priority: 10,
  ...overrides,
});

describe('coach reminder dedupe', () => {
  it('keeps only one reminder for the same id', () => {
    const result = dedupeCoachReminders([
      reminder({ id: 'same', message: '胸部酸痛，建议保守训练。', priority: 30 }),
      reminder({ id: 'same', message: '胸部酸痛较明显，建议今天降低相关部位压力。', priority: 80 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe(80);
    expect(result[0].message).toContain('胸部酸痛较明显');
  });

  it('merges semantically similar chest and back recovery reminders', () => {
    const result = dedupeCoachReminders([
      reminder({
        id: 'daily-adjustment',
        title: '今日自动调整',
        message: '今天标记胸部和背部酸痛，建议保守处理。',
        tone: 'warning',
        priority: 75,
      }),
      reminder({
        id: 'recovery-warning',
        title: '恢复提醒',
        message: '今天标记胸/背酸痛，训练建议降低相关部位压力。',
        tone: 'warning',
        priority: 70,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('daily-adjustment');
  });

  it('keeps the higher-priority recovery reminder', () => {
    const result = dedupeCoachReminders([
      reminder({
        id: 'low-priority',
        title: '恢复提醒',
        message: '肩部酸痛，建议略微保守。',
        priority: 20,
      }),
      reminder({
        id: 'high-priority',
        title: '今日自动调整',
        message: '肩部酸痛与上肢训练冲突较高，建议改为低冲突安排。',
        tone: 'warning',
        priority: 90,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('high-priority');
    expect(result[0].title).toBe('今日自动调整');
  });

  it('limits visible reminders and folds the rest', () => {
    const { visible, hidden } = splitCoachReminders(
      [
        reminder({ id: 'data', title: '数据提醒', message: '训练汇总可能过期。', tone: 'danger', priority: 100 }),
        reminder({ id: 'recovery', title: '恢复提醒', message: '胸部酸痛，建议保守。', tone: 'warning', priority: 80 }),
        reminder({ id: 'next', title: '下次建议', message: '下次按计划继续。', priority: 60 }),
      ],
      2,
    );

    expect(visible).toHaveLength(2);
    expect(hidden).toHaveLength(1);
    expect(visible.map((item) => item.id)).toEqual(['data', 'recovery']);
  });

  it('renders Today pipeline coach advice without duplicate legacy recovery warnings', () => {
    const data = makeAppData({
      todayStatus: {
        sleep: '好',
        energy: '中',
        time: '60',
        soreness: ['胸', '背'],
      },
    });
    const legacySummary: CoachAutomationSummary = {
      keyWarnings: ['今天标记胸/背酸痛，建议降低相关部位训练压力。'],
      recommendedActions: [
        {
          id: 'daily-adjustment-soreness',
          label: '今日自动调整',
          actionType: 'apply_daily_adjustment',
          reason: '今天标记胸部和背部酸痛，建议保守处理。',
          requiresConfirmation: true,
        },
      ],
    };

    const text = visibleText(
      React.createElement(TodayView, {
        data,
        selectedTemplate: getTemplate('push-a'),
        suggestedTemplate: getTemplate('pull-a'),
        weeklyPrescription: buildWeeklyPrescription(data),
        coachAutomationSummary: legacySummary,
        trainingMode: 'hybrid',
        onModeChange: noop,
        onStatusChange: noop,
        onSorenessToggle: noop,
        onTemplateSelect: noop,
        onUseSuggestion: noop,
        onStart: noop,
        onResume: noop,
      } as React.ComponentProps<typeof TodayView> & { coachAutomationSummary: CoachAutomationSummary }),
    );

    expect(text).toContain('教练提醒');
    expect(text).toContain('今日自动调整');
    expect(text).not.toContain('今天标记胸/背酸痛，建议降低相关部位训练压力。');
    expect(text.match(/今天标记胸部和背部酸痛/g)?.length || 0).toBeLessThanOrEqual(1);
  });

  it('does not output undefined, null, or raw enum text', () => {
    const result = dedupeCoachReminders([
      reminder({
        id: '',
        title: '',
        message: 'undefined null high medium low modified_train active_recovery',
        priority: Number.NaN,
      }),
    ]);
    const text = result.map((item) => [item.title, item.message].join(' ')).join('\n');

    expect(text).not.toMatch(/\b(undefined|null|high|medium|low|modified_train|active_recovery)\b/);
    expect(text).toContain('教练提醒');
  });
});
