import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import { buildDailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import { type DataHealthIssue, sortDataHealthIssues } from '../src/engines/dataHealthEngine';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import type { ProgramTemplate, TrainingSession, TrainingTemplate } from '../src/models/training-model';
import { makeAppData, makeSession, templates } from './fixtures';

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const template = (id: string, name = id): TrainingTemplate => ({
  id,
  name,
  focus: name,
  duration: 50,
  note: '',
  exercises: [],
});

const programWithDays = (ids: string[]): ProgramTemplate => ({
  ...makeAppData().programTemplate,
  dayTemplates: ids.map((id, index) => ({
    id,
    name: id,
    focusMuscles: [],
    correctionBlockIds: [],
    mainExerciseIds: [],
    functionalBlockIds: [],
    estimatedDurationMin: 50 + index,
  })),
});

const completedSession = (
  id: string,
  date: string,
  templateId: string,
  setCount = 1,
  dataFlag?: TrainingSession['dataFlag'],
): TrainingSession => ({
  ...makeSession({
    id,
    date,
    templateId,
    exerciseId: templateId === 'legs-a' ? 'squat' : templateId === 'pull-a' ? 'lat-pulldown' : 'bench-press',
    setSpecs: Array.from({ length: setCount }, (_, index) => ({
      weight: 100,
      reps: index % 2 ? 6 : 5,
      rir: 2,
      techniqueQuality: 'good' as const,
    })),
  }),
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
  dataFlag,
});

const customCompletedSession = (id: string, date: string, templateId: string): TrainingSession => ({
  id,
  date,
  templateId,
  templateName: templateId,
  trainingMode: 'hybrid',
  exercises: [],
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
});

const visibleCoachText = (summary: ReturnType<typeof buildCoachAutomationSummary>) =>
  [
    ...summary.keyWarnings,
    ...(summary.todayAdjustment ? [summary.todayAdjustment.title, summary.todayAdjustment.summary, ...summary.todayAdjustment.reasons] : []),
    ...(summary.nextWorkout ? [summary.nextWorkout.templateName, summary.nextWorkout.reason, ...summary.nextWorkout.warnings] : []),
    ...(summary.dataHealth ? [summary.dataHealth.summary, ...summary.dataHealth.issues.flatMap((issue) => [issue.title, issue.message])] : []),
    ...summary.recommendedActions.flatMap((action) => [action.label, action.reason]),
  ].join('\n');

describe('coach automation hardening', () => {
  it('keeps PPL rotation from the program order', () => {
    const data = makeAppData({
      history: [completedSession('push-done', '2026-04-28', 'push-a')],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    expect(recommendation.templateId).toBe('pull-a');
  });

  it('supports upper/lower and custom program template order', () => {
    const upperLowerTemplates = [template('upper-a', 'Upper A'), template('lower-a', 'Lower A')];
    const upperLower = buildNextWorkoutRecommendation({
      history: [customCompletedSession('upper-done', '2026-04-28', 'upper-a')],
      templates: upperLowerTemplates,
      programTemplate: programWithDays(['upper-a', 'lower-a']),
    });

    const customTemplates = [template('custom-alpha'), template('custom-beta'), template('custom-gamma')];
    const custom = buildNextWorkoutRecommendation({
      history: [customCompletedSession('beta-done', '2026-04-28', 'custom-beta')],
      templates: customTemplates,
      programTemplate: programWithDays(['custom-alpha', 'custom-beta', 'custom-gamma']),
    });

    expect(upperLower.templateId).toBe('lower-a');
    expect(custom.templateId).toBe('custom-gamma');
  });

  it('falls back to PPL only when program order is unavailable', () => {
    const recommendation = buildNextWorkoutRecommendation({
      history: [completedSession('legs-done', '2026-04-28', 'legs-a')],
      templates,
      programTemplate: undefined,
    });

    expect(recommendation.templateId).toBe('push-a');
    expect(recommendation.templateId).not.toBe('legs-a');
  });

  it('maps experimental templates back to their source order', () => {
    const experimentalPush = { ...template('push-a-experiment', '推 A 实验'), sourceTemplateId: 'push-a', isExperimentalTemplate: true };
    const recommendation = buildNextWorkoutRecommendation({
      history: [customCompletedSession('experimental-push-done', '2026-04-28', 'push-a-experiment')],
      templates: [experimentalPush, template('pull-a', 'Pull A'), template('legs-a', 'Legs A')],
      programTemplate: programWithDays(['push-a', 'pull-a', 'legs-a']),
    });

    expect(recommendation.templateId).toBe('pull-a');
  });

  it('uses the newest formal history entry for daily adjustment signals', () => {
    const oldHigh = completedSession('old-high', '2026-04-20', 'legs-a', 20);
    const latestLow = completedSession('latest-low', '2026-04-28', 'push-a', 1);
    const latestHigh = completedSession('latest-high', '2026-04-29', 'legs-a', 20);
    const excludedLatestHigh = { ...latestHigh, id: 'excluded-latest-high', dataFlag: 'excluded' as const };

    const oldHighShouldNotCount = buildDailyTrainingAdjustment({
      recentHistory: [oldHigh, latestLow],
    });
    const newestHighShouldCount = buildDailyTrainingAdjustment({
      recentHistory: [oldHigh, latestLow, latestHigh],
    });
    const excludedShouldNotCount = buildDailyTrainingAdjustment({
      recentHistory: [oldHigh, latestLow, excludedLatestHigh],
    });

    expect(oldHighShouldNotCount.type).toBe('normal');
    expect(oldHighShouldNotCount.reasons.join('\n')).not.toContain('最新一场正式训练量较高');
    expect(newestHighShouldCount.type).toBe('main_only');
    expect(newestHighShouldCount.reasons.join('\n')).toContain('最新一场正式训练量较高');
    expect(excludedShouldNotCount.type).toBe('normal');
  });

  it('uses ConfirmDialog for critical set anomalies instead of window.confirm', () => {
    const source = sourceOf('src/features/TrainingFocusView.tsx');

    expect(source).toContain('detectSetAnomalies');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('确认保存这组？');
    expect(source).toContain('返回修改');
    expect(source).toContain('仍然保存');
    expect(source).toContain('confirmPendingAction');
    expect(source).not.toContain('window.confirm');
  });

  it('sorts and folds data health issues by severity', () => {
    const issues: DataHealthIssue[] = [
      { id: 'info-1', severity: 'info', category: 'history', title: '提示', message: '提示信息', canAutoFix: false },
      { id: 'warning-1', severity: 'warning', category: 'unit', title: '警告', message: '警告信息', canAutoFix: false },
      { id: 'error-1', severity: 'error', category: 'replacement', title: '错误', message: '错误信息', canAutoFix: false },
      { id: 'warning-2', severity: 'warning', category: 'summary', title: '警告二', message: '警告信息', canAutoFix: false },
    ];
    const sorted = sortDataHealthIssues(issues);
    const profileSource = sourceOf('src/features/ProfileView.tsx');
    const recordSource = sourceOf('src/features/RecordView.tsx');

    expect(sorted.map((issue) => issue.severity)).toEqual(['error', 'warning', 'warning', 'info']);
    expect(profileSource).toContain('buildDataHealthViewModel');
    expect(profileSource).toContain('primaryIssues');
    expect(profileSource).toContain('查看全部问题');
    expect(recordSource).toContain('buildDataHealthViewModel');
    expect(recordSource).toContain('primaryIssues');
    expect(recordSource).toContain('查看全部问题');
  });

  it('gives every Today coach action an explicit path or view-only explanation', () => {
    const source = sourceOf('src/features/TodayView.tsx');

    expect(source).toContain('handleCoachAction');
    expect(source).toContain('去检查数据');
    expect(source).toContain('查看下次建议');
    expect(source).toContain('查看建议');
    expect(source).toContain('onReviewDataHealth');
    expect(source).toContain('不会自动覆盖计划');
  });

  it('does not mutate AppData and keeps visible text localized', () => {
    const broken = completedSession('broken', '2026-04-28', 'push-a');
    broken.exercises[0].actualExerciseId = 'bench-press__auto_alt';
    const data = makeAppData({ history: [broken] });
    const before = JSON.stringify(data);

    const text = visibleCoachText(buildCoachAutomationSummary(data));

    expect(JSON.stringify(data)).toBe(before);
    expect(text).not.toMatch(/\b(review_data|open_next_workout|apply_daily_adjustment|undefined|null|high|medium|low)\b/);
    expect(text).toMatch(/[数据训练建议]/);
  });
});
