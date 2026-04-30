import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildCoachActions,
  type CoachAction,
} from '../src/engines/coachActionEngine';
import { dismissCoachActionToday, filterDismissedCoachActions } from '../src/engines/coachActionDismissEngine';
import type { DataHealthReport } from '../src/engines/dataHealthEngine';
import type { NextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import { TodayView } from '../src/features/TodayView';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const todayAction = (id: string, title: string, priority: CoachAction['priority']): CoachAction => ({
  id,
  title,
  description: `${title} 的简短说明。`,
  source: id.includes('recovery') ? 'recovery' : 'dailyAdjustment',
  actionType: 'apply_temporary_session_adjustment',
  priority,
  status: 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: '2026-04-30T09:00:00.000Z',
  reason: `${title} 来自当前训练状态。`,
});

const planAction = (id: string, title: string, source: CoachAction['source'], actionType: CoachAction['actionType']): CoachAction => ({
  id,
  title,
  description: `${title} 的计划建议。`,
  source,
  actionType,
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: false,
  reversible: false,
  createdAt: '2026-04-30T09:00:00.000Z',
  targetId: source === 'plateau' ? 'bench-press' : 'back',
  targetType: source === 'plateau' ? 'exercise' : 'muscle',
  reason: `${title} 需要查看详情。`,
});

const renderToday = (coachActions: CoachAction[]) => {
  const data = makeAppData();
  return visibleText(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate('push-a'),
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions,
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
    }),
  );
};

const renderPlan = (coachActions: CoachAction[]) => {
  const data = makeAppData();
  return visibleText(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions,
      selectedTemplateId: data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
    }),
  );
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });

describe('coach action dismiss regression', () => {
  it('hides only the first Today action immediately and keeps the second action visible', () => {
    const first = todayAction('today-adjustment', '今日保守调整', 'high');
    const second = todayAction('today-recovery', '恢复提醒', 'medium');
    const actions = [first, second];
    const dismissed = [dismissCoachActionToday(first.id, '2026-04-30')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-04-30');
    const text = renderToday(visible);

    expect(visible.map((action) => action.id)).toEqual([second.id]);
    expect(text).not.toContain('今日保守调整');
    expect(text).toContain('恢复提醒');
    expect(text).toContain('暂不处理');
  });

  it('keeps the first Today action hidden after same-day re-render and restores it the next day', () => {
    const first = todayAction('today-adjustment', '今日保守调整', 'high');
    const second = todayAction('today-recovery', '恢复提醒', 'medium');
    const dismissed = [dismissCoachActionToday(first.id, '2026-04-30')];

    const sameDayText = renderToday(filterDismissedCoachActions([first, second], dismissed, '2026-04-30'));
    const rerenderText = renderToday(filterDismissedCoachActions([first, second], dismissed, '2026-04-30T20:00:00.000Z'));
    const nextDayText = renderToday(filterDismissedCoachActions([first, second], dismissed, '2026-05-01'));

    expect(sameDayText).not.toContain('今日保守调整');
    expect(rerenderText).not.toContain('今日保守调整');
    expect(nextDayText).toContain('今日保守调整');
    expect(nextDayText).toContain('恢复提醒');
  });

  it('uses the same dismiss behavior on Plan and leaves the second plan advice visible', () => {
    const first = planAction('plan-volume', '训练量建议', 'volumeAdaptation', 'review_volume');
    const second = planAction('plan-plateau', '动作进展建议', 'plateau', 'review_exercise');
    const dismissed = [dismissCoachActionToday(first.id, '2026-04-30')];

    const visible = filterDismissedCoachActions([first, second], dismissed, '2026-04-30');
    const text = renderPlan(visible);

    expect(visible.map((action) => action.id)).toEqual([second.id]);
    expect(text).not.toContain('训练量建议 的计划建议');
    expect(text).toContain('动作进展建议');
    expect(text).toContain('暂不处理');
  });

  it('keeps Plan dismiss state across same-day re-render and restores the action the next day', () => {
    const first = planAction('plan-volume', '训练量建议', 'volumeAdaptation', 'review_volume');
    const second = planAction('plan-plateau', '动作进展建议', 'plateau', 'review_exercise');
    const dismissed = [dismissCoachActionToday(first.id, '2026-04-30')];

    const rerenderText = renderPlan(filterDismissedCoachActions([first, second], dismissed, '2026-04-30T18:00:00.000Z'));
    const nextDayText = renderPlan(filterDismissedCoachActions([first, second], dismissed, '2026-05-01'));

    expect(rerenderText).not.toContain('训练量建议 的计划建议');
    expect(nextDayText).toContain('训练量建议');
    expect(nextDayText).toContain('动作进展建议');
  });

  it('does not delete DataHealth or recommendation source data when filtering dismissed actions', () => {
    const dataHealthReport: DataHealthReport = {
      status: 'has_errors',
      summary: '数据健康检查发现需要复查的问题。',
      issues: [
        {
          id: 'summary-mismatch-session-1',
          severity: 'error',
          category: 'summary',
          title: '训练汇总可能过期',
          message: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
          affectedIds: ['session-1'],
          canAutoFix: false,
        },
      ],
    };
    const nextWorkout: NextWorkoutRecommendation = {
      kind: 'train',
      templateId: 'pull-a',
      templateName: '拉 A',
      confidence: 'high',
      reason: '推 A 已完成，下次按计划轮转到拉 A。',
      warnings: [],
      alternatives: [],
    };
    const reportBefore = JSON.stringify(dataHealthReport);
    const nextWorkoutBefore = JSON.stringify(nextWorkout);
    const actions = buildCoachActions({
      appData: makeAppData(),
      dataHealthReport,
      nextWorkout,
      now: '2026-04-30T09:00:00.000Z',
    });
    const dismissed = [dismissCoachActionToday(actions[0].id, '2026-04-30')];

    filterDismissedCoachActions(actions, dismissed, '2026-04-30');

    expect(JSON.stringify(dataHealthReport)).toBe(reportBefore);
    expect(JSON.stringify(nextWorkout)).toBe(nextWorkoutBefore);
    expect(actions.length).toBeGreaterThan(1);
  });

  it('does not expose undefined, null, raw enum, or native browser dialogs in the dismiss path', () => {
    const text = [renderToday([]), renderPlan([])].join('\n');
    const source = sourceFiles('src')
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(text).not.toMatch(
      /\b(undefined|null|dailyAdjustment|volumeAdaptation|review_volume|review_exercise|apply_temporary_session_adjustment|pending|high|medium|low)\b/,
    );
    expect(source).not.toContain('window.alert');
    expect(source).not.toContain('window.confirm');
  });
});
