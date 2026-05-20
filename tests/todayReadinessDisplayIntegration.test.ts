import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';
import type { DailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import { todayKey } from '../src/engines/engineUtils';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildTodayTrainingReadinessDecision } from '../src/engines/todayTrainingReadinessDecisionEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import { TodayView } from '../src/features/TodayView';
import type { TrainingTemplate } from '../src/models/training-model';
import {
  buildTodayReadinessHeroDecision,
  TodayReadinessDecisionSummary,
} from '../src/uiOs/today/TodayReadinessDecisionSummary';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderTodayText = (data = makeAppData(), selectedTemplate: TrainingTemplate = getTemplate(data.selectedTemplateId || 'push-a')) =>
  visibleText(
    React.createElement(TodayView, {
      data,
      selectedTemplate,
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onViewSession: noop,
      onViewCalendar: noop,
      onReviewDataHealth: noop,
    }),
  );

const baselineHistory = () => [
  makeSession({ id: 'baseline-1', date: '2026-05-01', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' }] }),
  makeSession({ id: 'baseline-2', date: '2026-05-03', templateId: 'pull-a', exerciseId: 'barbell-row', setSpecs: [{ weight: 70, reps: 8, rir: 2, techniqueQuality: 'good' }] }),
  makeSession({ id: 'baseline-3', date: '2026-05-05', templateId: 'legs-a', exerciseId: 'squat', setSpecs: [{ weight: 90, reps: 6, rir: 2, techniqueQuality: 'good' }] }),
  makeSession({ id: 'baseline-4', date: '2026-05-08', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2, techniqueQuality: 'good' }] }),
  makeSession({ id: 'baseline-5', date: '2026-05-11', templateId: 'pull-a', exerciseId: 'barbell-row', setSpecs: [{ weight: 72.5, reps: 8, rir: 2, techniqueQuality: 'good' }] }),
  makeSession({ id: 'baseline-6', date: '2026-05-14', templateId: 'legs-a', exerciseId: 'squat', setSpecs: [{ weight: 92.5, reps: 6, rir: 2, techniqueQuality: 'good' }] }),
];

const adjustment = (overrides: Partial<DailyTrainingAdjustment>): DailyTrainingAdjustment => ({
  type: 'normal',
  title: '今日安排',
  summary: '按计划执行。',
  reasons: [],
  suggestedChanges: [],
  confidence: 'high',
  requiresUserConfirmation: false,
  ...overrides,
});

const decisionFor = (todayAdjustment: DailyTrainingAdjustment) =>
  buildTodayTrainingReadinessDecision({
    context: buildTrainingDecisionContext(makeAppData(), '2026-05-20', {
      currentTrainingTemplate: getTemplate('push-a'),
      activeTemplate: getTemplate('push-a'),
    }),
    todayAdjustment,
    nowIso: '2026-05-20T12:00:00.000Z',
  });

describe('Today readiness display integration', () => {
  it('renders the 18E normal decision in the Today hero while preserving the start action', () => {
    const text = renderTodayText(
      makeAppData({
        history: baselineHistory(),
        todayStatus: { sleep: '好', energy: '高', time: '90', soreness: ['无'] },
      }),
    );

    expect(text).toContain('今天按计划');
    expect(text).toContain('状态正常，按计划训练。');
    expect(text).toContain('开始今天训练');
  });

  it('renders active-session and completed-today readiness copy without changing primary actions', () => {
    const today = todayKey();
    const activeSession = {
      ...makeSession({ id: 'active-today', date: today, templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [] }),
      completed: false,
    };
    const completedSession = makeSession({
      id: 'done-today',
      date: today,
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8 }],
    });

    const activeText = renderTodayText(makeAppData({ activeSession }));
    const completedText = renderTodayText(makeAppData({ history: [completedSession] }));

    expect(activeText).toContain('继续训练');
    expect(activeText).toContain('当前有未完成训练，先继续记录。');
    expect(completedText).toContain('今日已完成');
    expect(completedText).toContain('今天已完成训练，下次建议仅供参考。');
    expect(completedText).toContain('查看本次训练');
  });

  it('renders severe-data and no-plan readiness copy through the Today hero', () => {
    const badSession = makeSession({
      id: 'bad-session',
      date: '2026-05-18',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 45, reps: 10 }],
    });
    const severeText = renderTodayText(
      makeAppData({
        history: [{ ...badSession, exercises: [{ ...badSession.exercises[0], id: 'unknown-exercise-id' }] }],
      }),
    );
    const noPlanTemplate = { ...getTemplate('push-a'), id: '' };
    const noPlanText = renderTodayText(makeAppData({ templates: [], selectedTemplateId: '' }), noPlanTemplate);

    expect(severeText).toContain('先查看数据');
    expect(severeText).toContain('先查看数据，再决定。');
    expect(severeText).toContain('查看严重问题');
    expect(noPlanText).toContain('先检查训练安排');
    expect(noPlanText).toContain('查看计划');
  });

  it('maps conservative, technique, deload, and recovery decisions to concise display labels', () => {
    const surface = buildTodayDecisionSurface({ recommendedFocus: '推 A' });
    const conservative = buildTodayReadinessHeroDecision(surface, decisionFor(adjustment({ type: 'conservative', requiresUserConfirmation: true })));
    const technique = buildTodayReadinessHeroDecision(
      surface,
      decisionFor(
        adjustment({
          type: 'conservative',
          reasons: ['动作质量需要优先。'],
          suggestedChanges: [{ type: 'reduce_volume', reason: '动作质量优先。' }],
          requiresUserConfirmation: true,
        }),
      ),
    );
    const deload = buildTodayReadinessHeroDecision(surface, decisionFor(adjustment({ type: 'deload_like', requiresUserConfirmation: true })));
    const recovery = buildTodayReadinessHeroDecision(surface, decisionFor(adjustment({ type: 'rest_or_recovery', requiresUserConfirmation: true })));

    expect(conservative.heroTitle).toBe('今天保守训练');
    expect(conservative.readinessLabel).toBe('建议保守');
    expect(technique.heroTitle).toBe('今天先稳住动作');
    expect(technique.readinessLabel).toBe('动作优先');
    expect(deload.heroTitle).toBe('今天降量');
    expect(deload.readinessLabel).toBe('建议降量');
    expect(recovery.heroTitle).toBe('恢复优先');
    expect(recovery.readinessLabel).toBe('建议恢复');
  });

  it('renders compact suggested action chips and passive preview only', () => {
    const decision = decisionFor(adjustment({ type: 'reduce_support', requiresUserConfirmation: true }));
    const text = visibleText(React.createElement(TodayReadinessDecisionSummary, { decision }));

    expect(text).toContain('不主动加量');
    expect(text).toContain('保留主训练');
    expect(text).toContain('减少辅助');
    expect(text).toContain('只影响本次，不改变计划');
    expect(text).not.toContain('应用到计划');
    expect(text).not.toContain('自动调整');
  });
});
