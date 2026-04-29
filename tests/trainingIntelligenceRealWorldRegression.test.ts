import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionCompletedSets } from '../src/engines/engineUtils';
import { buildHealthSummary } from '../src/engines/healthSummaryEngine';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { buildSessionDetailSummary, getSessionWarmupSets } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet, validateSessionEdit } from '../src/engines/sessionEditEngine';
import { filterAnalyticsHistory } from '../src/engines/sessionHistoryEngine';
import { buildSessionQualityResult } from '../src/engines/sessionQualityEngine';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import { buildTrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
import { buildVolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import type { ImportedWorkoutSample, MuscleVolumeDashboardRow, TrainingSession, UnitSettings } from '../src/models/training-model';
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
  date: string,
  setSpecs = [
    { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' as const },
    { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' as const },
    { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' as const },
  ],
  dataFlag?: TrainingSession['dataFlag'],
): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}-${dataFlag || 'normal'}`,
    date,
    templateId,
    exerciseId,
    setSpecs,
  }),
  startedAt: `${date}T09:00:00-04:00`,
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
  dataFlag,
});

const withWarmup = (session: TrainingSession, exerciseId: string): TrainingSession => ({
  ...session,
  focusWarmupSetLogs: [
    {
      id: `main:${exerciseId}:warmup:0`,
      type: 'warmup',
      weight: 20,
      actualWeightKg: 20,
      reps: 8,
      rir: '',
      done: true,
      note: '',
    },
  ],
});

const volumeRow = (overrides: Partial<MuscleVolumeDashboardRow> & { muscleId: string }): MuscleVolumeDashboardRow => ({
  muscleId: overrides.muscleId,
  muscleName: overrides.muscleName || overrides.muscleId,
  targetSets: overrides.targetSets ?? 10,
  completedSets: overrides.completedSets ?? 8,
  effectiveSets: overrides.effectiveSets ?? 7,
  highConfidenceEffectiveSets: overrides.highConfidenceEffectiveSets ?? 6,
  weightedEffectiveSets: overrides.weightedEffectiveSets ?? 8,
  remainingSets: overrides.remainingSets ?? Math.max(0, (overrides.targetSets ?? 10) - (overrides.weightedEffectiveSets ?? 8)),
  status: overrides.status || 'near_target',
  notes: overrides.notes || [],
});

const chineseText = /[\u3400-\u9fff]/;

describe('training intelligence real-world regression', () => {
  it('keeps Push A quality and summary grounded in working sets while warmups stay out of effective sets', () => {
    const baseSession = completedSession('push-a', 'bench-press', '2026-04-20');
    const session = withWarmup(baseSession, 'bench-press');

    const quality = buildSessionQualityResult({ session });
    const summary = buildSessionDetailSummary(session, unitSettings);
    const effectiveWithWarmup = buildEffectiveVolumeSummary([session]);
    const effectiveWithoutWarmup = buildEffectiveVolumeSummary([baseSession]);

    expect(quality.title).toBeTruthy();
    expect(quality.summary).toBeTruthy();
    expect([...quality.positives, ...quality.issues, ...quality.nextSuggestions].length).toBeGreaterThan(0);
    expect(summary.workingSetCount).toBe(3);
    expect(summary.warmupSetCount).toBe(1);
    expect(summary.workingVolumeKg).toBe(1440);
    expect(summary.warmupVolumeKg).toBe(160);
    expect(summary.effectiveSetCount).toBe(effectiveWithoutWarmup.effectiveSets);
    expect(effectiveWithWarmup.completedSets).toBe(effectiveWithoutWarmup.completedSets);
    expect(effectiveWithWarmup.effectiveSets).toBe(effectiveWithoutWarmup.effectiveSets);
  });

  it('rotates away from Legs A and still produces volume adaptation after completing Legs A', () => {
    const legsSession = completedSession('legs-a', 'squat', '2026-04-21', [
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
    ]);
    const data = makeAppData({ selectedTemplateId: 'legs-a', history: [legsSession] });

    const nextWorkout = buildNextWorkoutRecommendation({
      history: data.history,
      programTemplate: data.programTemplate,
      templates: data.templates,
    });
    const volume = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        volumeRow({
          muscleId: 'legs',
          muscleName: '腿部',
          targetSets: 12,
          completedSets: 9,
          effectiveSets: 8,
          weightedEffectiveSets: 9,
          remainingSets: 3,
          status: 'near_target',
        }),
      ],
      effectiveSetSummary: buildEffectiveVolumeSummary(data.history),
      trainingLevel: 'intermediate',
    });

    expect(nextWorkout.templateId).not.toBe('legs-a');
    if (nextWorkout.templateId === 'legs-a') {
      expect(`${nextWorkout.reason}\n${nextWorkout.warnings.join('\n')}`).toMatch(chineseText);
    }
    expect(volume.muscles).toHaveLength(1);
    expect(volume.summary).toBeTruthy();
  });

  it('prompts for abnormal weight, allows confirmed save, and keeps that anomaly low-confidence', () => {
    const previous = completedSession('push-a', 'bench-press', '2026-04-22', [
      { weight: 70, reps: 8, rir: 2, techniqueQuality: 'good' },
    ]);
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
      previousSets: previous.exercises[0].sets,
      recentHistory: [previous],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 70, plannedReps: 8, repMax: 10, stepType: 'working' },
    });
    const confirmed = anomalies.some((item) => item.severity === 'critical' && item.requiresConfirmation);
    const saved = confirmed
      ? updateSessionSet(previous, 'bench-press', 'bench-press-1', {
          weightKg: 155,
          reps: 8,
          rir: 2,
          techniqueQuality: 'poor',
          painFlag: true,
        })
      : previous;

    expect(confirmed).toBe(true);
    expect(saved.exercises[0].sets[0].weight).toBe(155);
    expect(validateSessionEdit(saved).valid).toBe(true);
    expect(buildEffectiveVolumeSummary([saved]).highConfidenceEffectiveSets).toBe(0);
    expect(buildPrs([saved]).filter((item) => item.exerciseId === 'bench-press').every((item) => item.quality !== 'high_quality')).toBe(true);
    expect(buildE1RMProfile([saved], 'bench-press').best?.confidence).not.toBe('high');
  });

  it('recalculates PR, e1RM, and effective sets after editing a working set', () => {
    const session = completedSession('legs-a', 'squat', '2026-04-23', [
      { weight: 100, reps: 5, rir: 5, techniqueQuality: 'good' },
    ]);
    const baselineEffective = buildEffectiveVolumeSummary([session]);
    const baselineE1rm = buildE1RMProfile([session], 'squat').best?.e1rmKg || 0;
    const baselineWeightPr = buildPrs([session]).find((item) => item.exerciseId === 'squat' && item.metric === 'max_weight')?.raw || 0;

    const edited = markSessionEdited(
      updateSessionSet(session, 'squat', 'squat-1', {
        weightKg: 120,
        reps: 6,
        rir: 1,
        techniqueQuality: 'good',
      }),
      ['sets'],
      '历史正式组修正',
    );
    const nextEffective = buildEffectiveVolumeSummary([edited]);
    const nextE1rm = buildE1RMProfile([edited], 'squat').best?.e1rmKg || 0;
    const nextWeightPr = buildPrs([edited]).find((item) => item.exerciseId === 'squat' && item.metric === 'max_weight')?.raw || 0;

    expect(validateSessionEdit(edited).valid).toBe(true);
    expect(nextEffective.effectiveSets).toBeGreaterThan(baselineEffective.effectiveSets);
    expect(nextE1rm).toBeGreaterThan(baselineE1rm);
    expect(nextWeightPr).toBeGreaterThan(baselineWeightPr);
    expect(edited.editedAt).toBeTruthy();
    expect(edited.editHistory?.[0].fields).toContain('sets');
  });

  it('updates warmup summary after warmup edits without changing PR, e1RM, or effective sets', () => {
    const session = withWarmup(
      completedSession('legs-a', 'squat', '2026-04-24', [
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      ]),
      'squat',
    );
    const baselineSummary = buildSessionDetailSummary(session, unitSettings);
    const baselineEffective = buildEffectiveVolumeSummary([session]);
    const baselineE1rm = buildE1RMProfile([session], 'squat').best?.e1rmKg;
    const baselinePrs = buildPrs([session]).filter((item) => item.exerciseId === 'squat');

    const edited = markSessionEdited(
      updateSessionSet(session, 'squat', 'main:squat:warmup:0', {
        weightKg: 60,
        reps: 6,
        rir: 4,
        note: '热身组修正',
      }),
      ['warmupSets'],
      '历史热身组修正',
    );
    const nextSummary = buildSessionDetailSummary(edited, unitSettings);
    const nextEffective = buildEffectiveVolumeSummary([edited]);

    expect(getSessionWarmupSets(edited)[0].set.weight).toBe(60);
    expect(nextSummary.warmupVolumeKg).toBeGreaterThan(baselineSummary.warmupVolumeKg);
    expect(nextSummary.workingVolumeKg).toBe(baselineSummary.workingVolumeKg);
    expect(nextEffective.effectiveSets).toBe(baselineEffective.effectiveSets);
    expect(buildE1RMProfile([edited], 'squat').best?.e1rmKg).toBe(baselineE1rm);
    expect(buildPrs([edited]).filter((item) => item.exerciseId === 'squat')).toEqual(baselinePrs);
    expect(edited.editHistory?.[0].fields).toContain('warmupSets');
  });

  it('keeps replacement actualExerciseId and isolates replacement analytics from the original exercise', () => {
    const squatSession = completedSession('legs-a', 'squat', '2026-04-25', [
      { weight: 140, reps: 5, rir: 2, techniqueQuality: 'good' },
    ]);
    const replaced = applyExerciseReplacement(squatSession, 0, 'leg-press');
    const benchPress = getTemplate('push-a').exercises.find((exercise) => exercise.id === 'bench-press');
    if (!benchPress) throw new Error('Missing bench press fixture');

    const smartReplacements = buildSmartReplacementRecommendations({
      currentExercise: benchPress,
      exerciseLibrary: templates.flatMap((template) => template.exercises),
    });

    expect(replaced.exercises[0].originalExerciseId).toBe('squat');
    expect(replaced.exercises[0].actualExerciseId).toBe('leg-press');
    expect(replaced.exercises[0].actualExerciseId).not.toContain('__');
    expect(buildE1RMProfile([replaced], 'squat').best).toBeUndefined();
    expect(buildE1RMProfile([replaced], 'leg-press').best).toBeTruthy();
    expect(buildPrs([replaced]).some((item) => item.exerciseId === 'squat')).toBe(false);
    expect(smartReplacements.length).toBeGreaterThan(0);
    expect(smartReplacements.every((item) => chineseText.test(item.reason))).toBe(true);
  });

  it('keeps test and excluded sessions out of intelligence while their logs remain viewable', () => {
    const testSession = completedSession('push-a', 'bench-press', '2026-04-26', undefined, 'test');
    const excludedSession = completedSession('legs-a', 'squat', '2026-04-27', undefined, 'excluded');
    const intelligence = buildTrainingIntelligenceSummary({
      latestSession: testSession,
      history: [testSession, excludedSession],
      trainingLevel: 'intermediate',
    });
    const analyticsHistory = filterAnalyticsHistory([testSession, excludedSession]);

    expect(analyticsHistory).toEqual([]);
    expect(intelligence.sessionQuality).toBeUndefined();
    expect(intelligence.recommendationConfidence).toEqual([]);
    expect(intelligence.plateauResults).toEqual([]);
    expect(buildEffectiveVolumeSummary([testSession, excludedSession]).completedSets).toBe(0);
    expect(sessionCompletedSets(testSession)).toBeGreaterThan(0);
    expect(buildSessionDetailSummary(excludedSession, unitSettings).workingSetCount).toBeGreaterThan(0);
  });

  it('uses Apple Health external workouts for activity context without creating strength history', () => {
    const importedWorkout: ImportedWorkoutSample = {
      id: 'apple-watch-run-1',
      source: 'apple_watch_workout',
      sourceName: 'Apple Watch',
      deviceSourceName: 'Apple Watch',
      workoutType: '户外跑步',
      startDate: '2026-04-28T11:00:00.000Z',
      endDate: '2026-04-28T12:10:00.000Z',
      durationMin: 70,
      activeEnergyKcal: 620,
      importedAt: '2026-04-28T12:20:00.000Z',
    };
    const data = makeAppData({ history: [], importedWorkoutSamples: [importedWorkout] });
    const healthSummary = buildHealthSummary([], data.importedWorkoutSamples, {
      endDate: '2026-04-29T23:59:59.000Z',
      days: 2,
    });
    const intelligence = buildTrainingIntelligenceSummary({
      history: data.history,
      trainingLevel: 'intermediate',
    });

    expect(healthSummary.recentWorkoutCount).toBe(1);
    expect(healthSummary.activityLoad?.previous48hWorkoutMinutes).toBeGreaterThan(0);
    expect(data.history).toEqual([]);
    expect(buildEffectiveVolumeSummary(data.history).completedSets).toBe(0);
    expect(buildPrs(filterAnalyticsHistory(data.history))).toEqual([]);
    expect(intelligence.sessionQuality).toBeUndefined();
  });
});
