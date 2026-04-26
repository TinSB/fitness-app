import { describe, expect, it } from 'vitest';
import { STORAGE_VERSION } from '../src/data/trainingData';
import { migrateTrainingData, sanitizeData, sanitizeProgramTemplate, validateAppDataSchema, validateProgramSchema } from '../src/storage/persistence';

describe('persistence', () => {
  it('migrates legacy data without schemaVersion and preserves user history', () => {
    const rawLegacyData = {
      templates: [
        {
          id: 'push-a',
          name: 'Push A',
          focus: '推',
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
              muscle: '胸',
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
    expect(sanitized.history[0]?.supportExerciseLogs).toEqual([]);
    expect(sanitized.todayStatus.time).toBe('60');
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
    expect(repaired.dayTemplates).toEqual([]);
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
              muscle: '胸',
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
    expect(sanitized.history).toHaveLength(1);
  });

  it('sanitizes activeSession rest timer state and keeps unfinished sessions recoverable', () => {
    const sanitized = sanitizeData({
      activeSession: {
        id: 'active',
        date: '2026-04-25',
        templateId: 'push-a',
        templateName: 'Push A',
        trainingMode: 'hybrid',
        completed: false,
        restTimerState: {
          exerciseId: 'bench-press',
          setIndex: 1,
          startedAt: '2026-04-25T10:00:00.000Z',
          durationSec: '120',
          isRunning: true,
        },
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
    });

    expect(sanitized.activeSession?.id).toBe('active');
    expect(sanitized.activeSession?.restTimerState?.durationSec).toBe(120);
  });

  it('drops completed activeSession during recovery', () => {
    const sanitized = sanitizeData({
      activeSession: {
        id: 'already-finished',
        date: '2026-04-25',
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
    });

    expect(sanitized.activeSession).toBeNull();
  });
});
