import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildCoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { todayKey } from '../src/engines/engineUtils';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { filterAnalyticsHistory } from '../src/engines/sessionHistoryEngine';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import type { ImportedWorkoutSample, TrainingSession, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession, templates } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const completedSession = (
  templateId: string,
  exerciseId: string,
  date = todayKey(),
  dataFlag?: TrainingSession['dataFlag'],
) => ({
  ...makeSession({
    id: `${templateId}-${date}-${dataFlag || 'normal'}`,
    date,
    templateId,
    exerciseId,
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
  dataFlag,
});

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coach automation real workout flow', () => {
  it('recommends Pull A after completing Push A', () => {
    const data = makeAppData({
      selectedTemplateId: 'push-a',
      history: [completedSession('push-a', 'bench-press')],
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.nextWorkout?.templateId).toBe('pull-a');
    expect(summary.nextWorkout?.templateName).toBe('拉 A');
    expect(summary.nextWorkout?.reason).toContain('轮转');
  });

  it('does not recommend Legs A again after completing Legs A by default', () => {
    const data = makeAppData({
      selectedTemplateId: 'legs-a',
      history: [completedSession('legs-a', 'squat')],
    });

    const summary = buildCoachAutomationSummary(data);

    expect(summary.nextWorkout?.templateId).not.toBe('legs-a');
    expect(summary.nextWorkout?.templateId).toBe('push-a');
    expect(summary.nextWorkout?.warnings.join('\n')).not.toContain('仍是腿 A');
  });

  it('surfaces obvious set input anomalies without changing the draft', () => {
    const draft = {
      actualWeightKg: 155,
      displayWeight: 155,
      displayUnit: 'kg' as const,
      actualReps: 8,
      actualRir: 2,
      stepType: 'working',
    };

    const anomalies = detectSetAnomalies({
      currentDraft: draft,
      exerciseId: 'bench-press',
      previousSets: [{ id: 'prev', weight: 70, reps: 8, rir: 2, done: true }],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 70, plannedReps: 8, repMax: 10, stepType: 'working' },
    });

    expect(anomalies.some((item) => item.severity === 'critical' && item.requiresConfirmation)).toBe(true);
    expect(anomalies.map((item) => item.title).join('\n')).toMatch(/重量|单位/);
    expect(draft.actualWeightKg).toBe(155);
  });

  it('shows smart replacement ranking groups for Focus Mode', () => {
    const benchPress = getTemplate('push-a').exercises.find((exercise) => exercise.id === 'bench-press');
    if (!benchPress) throw new Error('Missing bench press fixture');

    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress,
      exerciseLibrary: templates.flatMap((template) => template.exercises),
    });
    const focusSource = sourceOf('src/features/TrainingFocusView.tsx');

    expect(recommendations.filter((item) => item.priority === 'primary').map((item) => item.exerciseId)).toEqual(
      expect.arrayContaining(['db-bench-press', 'machine-chest-press']),
    );
    expect(focusSource).toContain("title: '推荐'");
    expect(focusSource).toContain("title: '可选'");
    expect(focusSource).toContain("title: '角度变化'");
    expect(focusSource).toContain("title: '不建议'");
  });

  it('shows data health issues in My and Record data surfaces', () => {
    const broken = completedSession('push-a', 'bench-press');
    broken.exercises[0] = {
      ...broken.exercises[0],
      originalExerciseId: 'bench-press',
      actualExerciseId: 'bench-press__auto_alt',
    };

    const summary = buildCoachAutomationSummary(makeAppData({ history: [broken] }));

    expect(summary.dataHealth?.status).toBe('has_errors');
    expect(summary.recommendedActions[0]?.actionType).toBe('review_data');
    expect(sourceOf('src/features/ProfileView.tsx')).toContain('数据健康检查');
    expect(sourceOf('src/features/RecordView.tsx')).toContain('数据健康检查');
  });

  it('recalculates history analytics after an edit and keeps the edit notice visible', () => {
    const session = makeSession({
      id: 'edit-squat',
      date: '2026-04-27',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const before = buildSessionDetailSummary(session, unitSettings);
    const beforeE1rm = buildE1RMProfile([session], 'squat').best?.e1rmKg || 0;

    const edited = markSessionEdited(
      updateSessionSet(session, 'squat', 'squat-1', {
        weightKg: 120,
        reps: 5,
        rir: 1,
        techniqueQuality: 'good',
      }),
      ['sets'],
      '历史训练详情修正',
    );
    const after = buildSessionDetailSummary(edited, unitSettings);

    expect(after.workingVolumeKg).toBeGreaterThan(before.workingVolumeKg);
    expect(buildE1RMProfile([edited], 'squat').best?.e1rmKg).toBeGreaterThan(beforeE1rm);
    expect(edited.editedAt).toBeTruthy();
    expect(edited.editHistory?.length).toBeGreaterThan(0);
    expect(sourceOf('src/features/RecordView.tsx')).toContain('保存后会重新计算 PR、e1RM、有效组和统计');
  });

  it('keeps Apple Watch external workouts out of strength history analytics', () => {
    const importedWorkout: ImportedWorkoutSample = {
      id: 'watch-workout-only',
      source: 'apple_watch_workout',
      sourceName: 'Apple Watch',
      deviceSourceName: 'Apple Watch',
      workoutType: '传统力量训练',
      startDate: `${todayKey()}T09:00:00.000Z`,
      endDate: `${todayKey()}T09:40:00.000Z`,
      durationMin: 40,
      activeEnergyKcal: 260,
      importedAt: `${todayKey()}T10:00:00.000Z`,
    };
    const data = makeAppData({ history: [], importedWorkoutSamples: [importedWorkout] });

    const summary = buildCoachAutomationSummary(data);

    expect(buildPrs(filterAnalyticsHistory(data.history))).toEqual([]);
    expect(summary.dataHealth?.issues.map((issue) => issue.title).join('\n')).not.toContain('外部活动进入力量训练历史');
    expect(summary.nextWorkout?.reason).toContain('还没有可用于轮转的正式训练记录');
  });

  it('excludes test and excluded sessions from recommendation and statistics', () => {
    const normalPush = completedSession('push-a', 'bench-press', '2026-04-24', 'normal');
    const testPull = completedSession('pull-a', 'lat-pulldown', '2026-04-25', 'test');
    const excludedLegs = completedSession('legs-a', 'squat', '2026-04-26', 'excluded');
    const data = makeAppData({ history: [excludedLegs, testPull, normalPush] });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });
    const analyticsHistory = filterAnalyticsHistory(data.history);

    expect(recommendation.templateId).toBe('pull-a');
    expect(analyticsHistory.map((session) => session.id)).toEqual([normalPush.id]);
    expect(buildEffectiveVolumeSummary(analyticsHistory).completedSets).toBeGreaterThan(0);
  });
});
