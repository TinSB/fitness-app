import { describe, expect, it } from 'vitest';
import type { E1RMProfile, PainPattern, TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { buildTrainingLevelAssessment } from '../src/engines/trainingLevelEngine';

const set = (index: number, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: `set-${index}`,
  type: 'straight',
  weight: 80,
  reps: 8,
  rir: 2,
  techniqueQuality: 'good',
  painFlag: false,
  done: true,
  ...overrides,
});

const session = (index: number, setOverrides: Partial<TrainingSetLog>[] = [{}]): TrainingSession =>
  ({
    id: `session-${index}`,
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    startedAt: `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    dataFlag: 'normal',
    exercises: [
      {
        id: 'bench-press',
        baseId: 'bench-press',
        canonicalExerciseId: 'bench-press',
        name: '卧推',
        muscle: 'chest',
        primaryMuscles: ['chest'],
        sets: setOverrides.map((overrides, setIndex) => set(setIndex, overrides)),
      },
    ],
  }) as TrainingSession;

const e1rmProfile = (exerciseId: string, confidence: 'low' | 'medium' | 'high' = 'high'): E1RMProfile => ({
  exerciseId,
  current: {
    exerciseId,
    e1rmKg: 100,
    formula: 'epley',
    confidence,
    sourceSet: {
      sessionId: 'session-1',
      date: '2026-04-01',
      weightKg: 80,
      reps: 8,
      rir: 2,
      techniqueQuality: 'good',
      painFlag: false,
    },
    notes: ['稳定记录'],
  },
  recentValues: [98, 100, 101],
  method: 'median_recent',
});

describe('trainingLevelEngine', () => {
  it('0 sessions returns unknown', () => {
    const assessment = buildTrainingLevelAssessment({ history: [] });

    expect(assessment.level).toBe('unknown');
    expect(assessment.confidence).toBe('low');
    expect(assessment.readinessForAdvancedFeatures.aggressiveProgression).toBe(false);
  });

  it('1-2 sessions remain unknown with low confidence', () => {
    const assessment = buildTrainingLevelAssessment({ history: [session(0), session(1)] });

    expect(assessment.level).toBe('unknown');
    expect(assessment.confidence).toBe('low');
    expect(assessment.nextDataNeeded.join(' ')).toContain('6 次');
  });

  it('multiple stable high-quality records can reach intermediate', () => {
    const history = Array.from({ length: 8 }, (_, index) => session(index));
    const assessment = buildTrainingLevelAssessment({
      history,
      e1rmProfiles: [e1rmProfile('bench-press'), e1rmProfile('squat', 'medium')],
    });

    expect(['intermediate', 'advanced']).toContain(assessment.level);
    expect(assessment.readinessForAdvancedFeatures.topBackoff).toBe(true);
  });

  it('a single heavy session cannot directly become advanced', () => {
    const assessment = buildTrainingLevelAssessment({
      history: [session(0, [{ weight: 180, reps: 5, rir: 1, techniqueQuality: 'good' }])],
      e1rmProfiles: [e1rmProfile('bench-press', 'high')],
    });

    expect(assessment.level).not.toBe('advanced');
    expect(assessment.readinessForAdvancedFeatures.aggressiveProgression).toBe(false);
  });

  it('poor technique prevents advanced classification', () => {
    const poorHistory = Array.from({ length: 14 }, (_, index) =>
      session(index, [
        { techniqueQuality: index % 2 === 0 ? 'poor' : 'acceptable', rir: 2 },
        { techniqueQuality: 'poor', rir: 2 },
      ]),
    );
    const assessment = buildTrainingLevelAssessment({
      history: poorHistory,
      e1rmProfiles: [e1rmProfile('bench-press'), e1rmProfile('squat')],
    });

    expect(assessment.level).not.toBe('advanced');
    expect(assessment.readinessForAdvancedFeatures.aggressiveProgression).toBe(false);
    expect(assessment.limitations.join(' ')).toContain('poor');
  });

  it('frequent pain signal downshifts advanced features', () => {
    const painPatterns: PainPattern[] = [
      {
        area: 'shoulder',
        exerciseId: 'bench-press',
        frequency: 4,
        severityAvg: 3,
        lastOccurredAt: '2026-04-20',
        suggestedAction: 'substitute',
      },
    ];
    const assessment = buildTrainingLevelAssessment({
      history: Array.from({ length: 12 }, (_, index) => session(index)),
      e1rmProfiles: [e1rmProfile('bench-press'), e1rmProfile('squat')],
      painPatterns,
    });

    expect(assessment.level).not.toBe('advanced');
    expect(assessment.readinessForAdvancedFeatures.higherVolume).toBe(false);
  });

  it('low adherence disables higher volume', () => {
    const assessment = buildTrainingLevelAssessment({
      history: Array.from({ length: 8 }, (_, index) => session(index)),
      e1rmProfiles: [e1rmProfile('bench-press'), e1rmProfile('squat')],
      adherenceReport: {
        recentSessionCount: 7,
        plannedSets: 70,
        actualSets: 35,
        overallRate: 50,
        mainlineRate: 50,
        recentSessions: [],
        skippedExercises: [],
        skippedSupportExercises: [],
        suggestions: [],
        confidence: 'high',
      },
    });

    expect(assessment.readinessForAdvancedFeatures.higherVolume).toBe(false);
  });

  it('enough stable high-quality records can reach advanced or high-confidence intermediate', () => {
    const assessment = buildTrainingLevelAssessment({
      history: Array.from({ length: 16 }, (_, index) => session(index)),
      e1rmProfiles: [e1rmProfile('bench-press'), e1rmProfile('squat'), e1rmProfile('lat-pulldown')],
      calendarData: {
        month: '2026-04',
        days: [],
        weeklyFrequency: [
          { weekStart: '2026-03-30', sessionCount: 4 },
          { weekStart: '2026-04-06', sessionCount: 4 },
          { weekStart: '2026-04-13', sessionCount: 4 },
          { weekStart: '2026-04-20', sessionCount: 4 },
        ],
      },
    });

    expect(['advanced', 'intermediate']).toContain(assessment.level);
    expect(assessment.confidence).toBe('high');
  });
});
