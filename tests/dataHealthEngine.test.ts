import { describe, expect, it } from 'vitest';
import { buildDataHealthReport, type DataHealthIssue } from '../src/engines/dataHealthEngine';
import type { AppData, HealthMetricSample, ImportedWorkoutSample, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const normalSession = () =>
  makeSession({
    id: 'normal-session',
    date: '2026-04-28',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  });

const issueWithCategory = (issues: DataHealthIssue[], category: DataHealthIssue['category'], titlePart: string) =>
  issues.find((item) => item.category === category && item.title.includes(titlePart));

const assertNoUndefinedOrNullText = (value: unknown) => {
  const text = JSON.stringify(value);
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('null');
};

describe('dataHealthEngine', () => {
  it('returns healthy for normal local training data', () => {
    const report = buildDataHealthReport(makeAppData({ history: [normalSession()] }));

    expect(report.status).toBe('healthy');
    expect(report.issues).toEqual([]);
    expect(report.summary).toContain('未发现明显异常');
    assertNoUndefinedOrNullText(report);
  });

  it('detects synthetic replacement ids without mutating data', () => {
    const session = normalSession();
    session.exercises[0] = {
      ...session.exercises[0],
      originalExerciseId: 'bench-press',
      actualExerciseId: 'bench-press__auto_alt',
      replacementExerciseId: '__alt_bench-press',
    };
    const data = makeAppData({ history: [session] });
    const before = JSON.stringify(data);
    const report = buildDataHealthReport(data);

    expect(issueWithCategory(report.issues, 'replacement', '无效替代动作编号')).toBeTruthy();
    expect(report.status).toBe('has_errors');
    expect(report.issues.every((item) => item.canAutoFix === false)).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
    assertNoUndefinedOrNullText(report);
  });

  it('detects unnecessary decimal display weights in lb mode', () => {
    const session = normalSession();
    const sets = session.exercises[0].sets;
    if (!Array.isArray(sets)) throw new Error('Expected set logs');
    sets[0] = {
      ...sets[0],
      actualWeightKg: 70.35,
      displayUnit: 'lb',
      displayWeight: 155.1,
    };

    const report = buildDataHealthReport(makeAppData({ history: [session] }));

    expect(issueWithCategory(report.issues, 'unit', '磅制重量显示')).toBeTruthy();
    expect(report.summary).toContain('只提示');
    assertNoUndefinedOrNullText(report);
  });

  it('warns when test or excluded training is marked as analytics-included', () => {
    const testSession = {
      ...normalSession(),
      id: 'test-session',
      dataFlag: 'test' as const,
      includedInAnalytics: true,
    } as TrainingSession & { includedInAnalytics: boolean };

    const report = buildDataHealthReport(makeAppData({ history: [testSession] }));
    const issue = issueWithCategory(report.issues, 'analytics', '仍被统计');

    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('不应进入 PR、e1RM、有效组或完成率统计');
    assertNoUndefinedOrNullText(report);
  });

  it('detects Apple Watch workouts written into strength session history', () => {
    const importedWorkout: ImportedWorkoutSample = {
      id: 'watch-workout-1',
      source: 'apple_watch_workout',
      sourceName: 'Apple Watch',
      deviceSourceName: 'Apple Watch',
      workoutType: '传统力量训练',
      startDate: '2026-04-28T09:00:00.000Z',
      endDate: '2026-04-28T09:45:00.000Z',
      durationMin: 45,
      activeEnergyKcal: 300,
      importedAt: '2026-04-28T10:00:00.000Z',
    };
    const pollutedHistory = {
      ...normalSession(),
      id: 'watch-workout-1',
      source: 'apple_watch_workout',
      importedWorkoutId: 'watch-workout-1',
    } as TrainingSession & { source: string; importedWorkoutId: string };

    const report = buildDataHealthReport(makeAppData({ history: [pollutedHistory], importedWorkoutSamples: [importedWorkout] }));
    const issue = issueWithCategory(report.issues, 'healthData', '外部活动进入力量训练历史');

    expect(issue).toBeTruthy();
    expect(issue?.message).toContain('不应自动变成 IronPath 力量训练记录');
    assertNoUndefinedOrNullText(report);
  });

  it('detects stale summary fields when set logs have real work', () => {
    const session = {
      ...normalSession(),
      completedSets: 0,
      totalVolumeKg: 0,
    } as TrainingSession & { completedSets: number; totalVolumeKg: number };

    const report = buildDataHealthReport(makeAppData({ history: [session] }));

    expect(issueWithCategory(report.issues, 'summary', '完成组数')).toBeTruthy();
    expect(issueWithCategory(report.issues, 'summary', '总量')).toBeTruthy();
  });

  it('detects warmup sets that can leak into PR or e1RM statistics', () => {
    const session = normalSession();
    const sets = session.exercises[0].sets;
    if (!Array.isArray(sets)) throw new Error('Expected set logs');
    sets.unshift({
      id: 'main:bench-press:warmup:0',
      weight: 20,
      reps: 8,
      done: true,
      e1rmKg: 25,
    } as unknown as typeof sets[number]);

    const report = buildDataHealthReport(makeAppData({ history: [session] }));

    expect(issueWithCategory(report.issues, 'history', '热身组缺少类型')).toBeTruthy();
    expect(issueWithCategory(report.issues, 'analytics', '热身组带有强度统计标记')).toBeTruthy();
  });

  it('detects excluded health data that is still marked for readiness', () => {
    const excludedSleep = {
      id: 'sleep-excluded',
      source: 'apple_health_export',
      metricType: 'sleep_duration',
      startDate: '2026-04-28T00:00:00.000Z',
      value: 4,
      unit: 'h',
      importedAt: '2026-04-28T08:00:00.000Z',
      dataFlag: 'excluded',
      includedInReadiness: true,
    } as HealthMetricSample & { includedInReadiness: boolean };
    const data: AppData = makeAppData({
      healthMetricSamples: [excludedSleep],
      settings: { healthIntegrationSettings: { useHealthDataForReadiness: true, showExternalWorkoutsInCalendar: true } },
    });

    const report = buildDataHealthReport(data);

    expect(issueWithCategory(report.issues, 'healthData', '排除的健康数据')).toBeTruthy();
    assertNoUndefinedOrNullText(report);
  });
});
