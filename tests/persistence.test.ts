import { describe, expect, it } from 'vitest';
import { STORAGE_VERSION } from '../src/data/trainingData';
import { migrateTrainingData, sanitizeData, sanitizeProgramTemplate, validateAppDataSchema, validateProgramSchema } from '../src/storage/persistence';

describe('persistence', () => {
  it('migrates legacy data without schemaVersion and preserves session history', () => {
    const rawLegacyData = {
      templates: [
        {
          id: 'push-a',
          name: 'Push A',
          focus: 'push',
          duration: 70,
          note: 'legacy',
          exercises: [],
        },
      ],
      history: [
        {
          id: 'legacy-session',
          date: '2026-04-20',
          template: { id: 'push-a', name: 'Push A' },
          exercises: [
            {
              id: 'bench-press',
              name: '卧推',
              muscle: 'chest',
              kind: 'compound',
              sets: [{ weight: 60, reps: 8, done: true }],
            },
          ],
          todayStatus: { sleep: '一般', energy: '中', soreness: ['无'], time: '60' },
        },
      ],
      status: { sleep: '一般', energy: '中', soreness: ['无'], time: '60' },
      selectedTemplate: 'push-a',
      mode: 'hybrid',
      program: { splitType: 'upper_lower' },
    };

    const migrated = migrateTrainingData(rawLegacyData);
    const sanitized = sanitizeData(migrated);

    expect(migrated.schemaVersion).toBe(STORAGE_VERSION);
    expect(sanitized.history).toHaveLength(1);
    expect(sanitized.history[0]?.templateId).toBe('push-a');
    expect(sanitized.history[0]?.programTemplateId).toBe('push-a');
    expect(sanitized.history[0]?.supportExerciseLogs).toEqual([]);
    expect(sanitized.history[0]?.loadFeedback).toEqual([]);
    expect(sanitized.mesocyclePlan.weeks.length).toBeGreaterThan(0);
  });

  it('repairs incomplete program templates before final schema validation', () => {
    const repaired = sanitizeProgramTemplate({
      splitType: 'upper_lower',
      daysPerWeek: 4,
      weeklyMuscleTargets: {
        chest: 12,
        back: '14',
      },
    });

    expect(validateProgramSchema(repaired)).toBe(true);
    expect(repaired.weeklyMuscleTargets.back).toBe(14);
    expect(Array.isArray(repaired.dayTemplates)).toBe(true);
  });

  it('validates sanitized app data against the app schema after migration', () => {
    const sanitized = sanitizeData({
      history: [
        {
          id: 'legacy-session',
          date: '2026-04-20',
          templateId: 'push-a',
          templateName: 'Push A',
          trainingMode: 'hybrid',
          exercises: [
            {
              id: 'bench-press',
              name: '卧推',
              muscle: 'chest',
              kind: 'compound',
              repMin: 6,
              repMax: 8,
              rest: 120,
              startWeight: 60,
              sets: [{ weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
      todayStatus: { sleep: '一般', energy: '中', soreness: ['无'], time: '60' },
      userProfile: { name: 'local' },
      settings: { trainingMode: 'hybrid' },
    });

    expect(validateAppDataSchema(sanitized)).toBe(true);
    expect(sanitized.history[0]?.programTemplateId).toBe('push-a');
  });

  it('keeps session template metadata compatible when old session fields are missing', () => {
    const sanitized = sanitizeData({
      history: [
        {
          id: 'legacy-session',
          date: '2026-04-20',
          templateId: 'push-a',
          templateName: 'Push A',
          trainingMode: 'hybrid',
          completed: true,
          exercises: [
            {
              id: 'bench-press',
              name: 'Bench Press',
              muscle: 'chest',
              kind: 'compound',
              repMin: 6,
              repMax: 8,
              rest: 120,
              startWeight: 60,
              sets: [{ id: 'set-1', weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
    });

    expect(sanitized.history[0]?.programTemplateId).toBe('push-a');
    expect(sanitized.history[0]?.programTemplateName).toBe('Push A');
    expect(sanitized.history[0]?.isExperimentalTemplate).toBe(false);
  });

  it('defaults missing session dataFlag to normal during migration', () => {
    const sanitized = sanitizeData({
      history: [
        {
          id: 'legacy-session',
          date: '2026-04-20',
          templateId: 'push-a',
          templateName: 'Push A',
          trainingMode: 'hybrid',
          completed: true,
          exercises: [
            {
              id: 'bench-press',
              name: 'Bench Press',
              muscle: 'chest',
              kind: 'compound',
              repMin: 6,
              repMax: 8,
              rest: 120,
              startWeight: 60,
              sets: [{ id: 'set-1', weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
    });

    expect(sanitized.history[0]?.dataFlag).toBe('normal');
  });

  it('preserves synthetic replacement ids for manual repair review during sanitize', () => {
    const sanitized = sanitizeData({
      history: [
        {
          id: 'synthetic-session',
          date: '2026-04-20',
          templateId: 'push-a',
          templateName: 'Push A',
          trainingMode: 'hybrid',
          exercises: [
            {
              id: 'bench-press__auto_alt_alt',
              baseId: 'bench-press',
              originalExerciseId: 'bench-press',
              actualExerciseId: 'bench-press__auto_alt_alt',
              replacementExerciseId: 'bench-press__auto_alt_alt',
              name: 'Bench synthetic',
              muscle: 'chest',
              kind: 'compound',
              repMin: 6,
              repMax: 8,
              rest: 120,
              startWeight: 60,
              sets: [{ id: 'set-1', weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
    });
    const exercise = sanitized.history[0]?.exercises[0];

    expect(exercise?.id).toBe('bench-press__auto_alt_alt');
    expect(exercise?.actualExerciseId).toBe('bench-press__auto_alt_alt');
    expect(exercise?.legacyActualExerciseId).toBe('bench-press__auto_alt_alt');
    expect(exercise?.replacementExerciseId).toBe('');
    expect(exercise?.warning).toContain('合成动作 ID');
  });

  it('migrates health import arrays and validates schema', () => {
    const sanitized = sanitizeData({
      healthMetricSamples: [
        {
          id: 'sleep-1',
          source: 'apple_health_export',
          metricType: 'sleep_duration',
          startDate: '2026-04-21T00:00:00.000Z',
          value: 7,
          unit: 'h',
          importedAt: '2026-04-22T00:00:00.000Z',
          batchId: 'batch-1',
          sourceName: 'Apple Watch',
          deviceSourceName: 'Apple Watch',
          raw: {
            sourceName: 'Apple Watch',
            xmlText: '<HealthData>large raw xml</HealthData>',
            nested: { fileText: '<HealthData>nested raw xml</HealthData>', value: 'kept' },
            longText: 'x'.repeat(800),
          },
        },
      ],
      importedWorkoutSamples: [
        {
          id: 'watch-1',
          source: 'apple_watch_workout',
          workoutType: '户外跑步',
          startDate: '2026-04-21T18:00:00.000Z',
          endDate: '2026-04-21T18:35:00.000Z',
          durationMin: 35,
          importedAt: '2026-04-22T00:00:00.000Z',
          batchId: 'batch-1',
          sourceName: 'Apple Watch',
          deviceSourceName: 'Apple Watch',
          raw: {
            workoutActivityType: 'HKWorkoutActivityTypeRunning',
            rawXml: '<Workout />',
          },
        },
      ],
      healthImportBatches: [
        {
          id: 'batch-1',
          source: 'apple_health_export',
          importedAt: '2026-04-22T00:00:00.000Z',
          sampleCount: 1,
          workoutCount: 1,
          newSampleCount: 1,
          duplicateSampleCount: 0,
          skippedSampleCount: 0,
          newWorkoutCount: 1,
          duplicateWorkoutCount: 0,
          skippedWorkoutCount: 0,
          notes: [],
        },
      ],
      settings: {
        healthIntegrationSettings: {
          useHealthDataForReadiness: false,
          showExternalWorkoutsInCalendar: false,
        },
      },
    });

    expect(sanitized.healthMetricSamples).toHaveLength(1);
    expect(sanitized.importedWorkoutSamples).toHaveLength(1);
    expect(sanitized.healthImportBatches).toHaveLength(1);
    expect(sanitized.healthMetricSamples?.[0]?.dataFlag).toBe('normal');
    expect(sanitized.healthMetricSamples?.[0]?.batchId).toBe('batch-1');
    expect(sanitized.healthMetricSamples?.[0]?.deviceSourceName).toBe('Apple Watch');
    expect(sanitized.healthImportBatches?.[0]?.duplicateSampleCount).toBe(0);
    const persistedHealthText = JSON.stringify({
      samples: sanitized.healthMetricSamples,
      workouts: sanitized.importedWorkoutSamples,
      batches: sanitized.healthImportBatches,
    });
    expect(persistedHealthText).not.toContain('xmlText');
    expect(persistedHealthText).not.toContain('fileText');
    expect(persistedHealthText).not.toContain('rawXml');
    expect(persistedHealthText).not.toContain('<HealthData>');
    expect(persistedHealthText).toContain('kept');
    expect(sanitized.settings.healthIntegrationSettings?.useHealthDataForReadiness).toBe(false);
    expect(sanitized.settings.healthIntegrationSettings?.showExternalWorkoutsInCalendar).toBe(false);
    expect(validateAppDataSchema(sanitized)).toBe(true);
  });

  it('migrates draft fields for source template hash and updatedAt', () => {
    const sanitized = sanitizeData({
      templates: [
        {
          id: 'push-a',
          name: 'Push A',
          focus: 'push',
          duration: 70,
          note: 'base',
          exercises: [],
        },
      ],
      programAdjustmentDrafts: [
        {
          id: 'draft-1',
          createdAt: '2026-04-26T00:00:00.000Z',
          status: 'stale',
          sourceProgramTemplateId: 'push-a',
          sourceTemplateSnapshotHash: 'tpl-123',
          sourceTemplateUpdatedAt: '2026-04-26T00:00:00.000Z',
          title: '下周实验调整',
          summary: 'preview',
          selectedRecommendationIds: ['rec-1'],
          changes: [
            {
              id: 'change-1',
              type: 'add_new_exercise',
              dayTemplateId: 'push-a',
              dayTemplateName: 'Push A',
              exerciseId: 'lat-pulldown',
              exerciseName: '高位下拉',
              sets: 2,
              repMin: 8,
              repMax: 12,
              restSec: 90,
              reason: '补背部周量',
            },
          ],
          confidence: 'low',
          notes: ['请手动确认'],
        },
      ],
    });

    expect(sanitized.programAdjustmentDrafts[0]?.status).toBe('stale');
    expect(sanitized.programAdjustmentDrafts[0]?.sourceTemplateSnapshotHash).toBe('tpl-123');
    expect(sanitized.programAdjustmentDrafts[0]?.sourceTemplateUpdatedAt).toBe('2026-04-26T00:00:00.000Z');
    expect(validateAppDataSchema(sanitized)).toBe(true);
  });

  it('keeps adjustment history compatible with template names, snapshots and effect review', () => {
    const sanitized = sanitizeData({
      programAdjustmentHistory: [
        {
          id: 'history-1',
          appliedAt: '2026-04-26T00:00:00.000Z',
          sourceProgramTemplateId: 'push-a',
          experimentalProgramTemplateId: 'push-a-experiment',
          sourceProgramTemplateName: 'Push A',
          experimentalProgramTemplateName: 'Push A 实验版',
          mainChangeSummary: 'Pull A 新增高位下拉 2 组',
          selectedRecommendationIds: ['rec-1'],
          changes: [
            {
              id: 'change-1',
              type: 'add_new_exercise',
              dayTemplateId: 'pull-a',
              dayTemplateName: 'Pull A',
              exerciseId: 'lat-pulldown',
              exerciseName: '高位下拉',
              sets: 2,
              repMin: 8,
              repMax: 12,
              restSec: 90,
              reason: '补背部周量',
            },
          ],
          rollbackAvailable: true,
          sourceProgramSnapshot: {
            id: 'program-hypertrophy-support',
            userId: 'local-user',
            primaryGoal: 'hypertrophy',
            splitType: 'upper_lower',
            daysPerWeek: 4,
            correctionStrategy: 'moderate',
            functionalStrategy: 'standard',
            weeklyMuscleTargets: { chest: 12, back: 14 },
            dayTemplates: [],
          },
          effectReview: {
            historyItemId: 'history-1',
            status: 'improved',
            confidence: 'medium',
            summary: '目标肌群训练量提升，完成度稳定。',
            metrics: {
              targetMuscleChange: 2.1,
              adherenceChange: 3,
              painSignalChange: 0,
              effectiveVolumeChange: 1.4,
              beforeSessionCount: 2,
              afterSessionCount: 2,
            },
            recommendation: 'keep',
          },
        },
      ],
    });

    expect(sanitized.programAdjustmentHistory[0]?.sourceProgramTemplateName).toBe('Push A');
    expect(sanitized.programAdjustmentHistory[0]?.mainChangeSummary).toContain('新增高位下拉');
    expect(sanitized.programAdjustmentHistory[0]?.sourceProgramSnapshot).toBeTruthy();
    expect(sanitized.programAdjustmentHistory[0]?.effectReview?.status).toBe('improved');
    expect(validateAppDataSchema(sanitized)).toBe(true);
  });
});
