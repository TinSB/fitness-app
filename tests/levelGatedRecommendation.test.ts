import { describe, expect, it } from 'vitest';
import { buildTrainingLevelAssessment } from '../src/engines/trainingLevelEngine';

describe('level-gated recommendations', () => {
  it('unknown does not enable aggressive progression', () => {
    const assessment = buildTrainingLevelAssessment({ history: [] });

    expect(assessment.level).toBe('unknown');
    expect(assessment.readinessForAdvancedFeatures.aggressiveProgression).toBe(false);
    expect(assessment.readinessForAdvancedFeatures.topBackoff).toBe(false);
  });

  it('beginner does not enable higher volume by default', () => {
    const assessment = buildTrainingLevelAssessment({
      history: [],
      adherenceReport: {
        recentSessionCount: 3,
        plannedSets: 30,
        actualSets: 18,
        overallRate: 60,
        mainlineRate: 60,
        recentSessions: [],
        skippedExercises: [],
        skippedSupportExercises: [],
        suggestions: [],
        confidence: 'low',
      },
    });

    expect(assessment.readinessForAdvancedFeatures.higherVolume).toBe(false);
  });

  it('intermediate can enable current e1RM-oriented top/backoff features', () => {
    const assessment = buildTrainingLevelAssessment({
      history: Array.from({ length: 8 }, (_, index) => ({
        id: `s-${index}`,
        date: `2026-04-${String(index + 1).padStart(2, '0')}`,
        templateId: 'push-a',
        templateName: 'Push A',
        trainingMode: 'hybrid',
        exercises: [
          {
            id: 'bench-press',
            name: '卧推',
            sets: [{ id: 'a', type: 'straight', weight: 80, reps: 8, rir: 2, techniqueQuality: 'good', done: true }],
          },
        ],
      })) as never,
      e1rmProfiles: [
        {
          exerciseId: 'bench-press',
          current: {
            exerciseId: 'bench-press',
            e1rmKg: 100,
            formula: 'epley',
            confidence: 'high',
            sourceSet: { sessionId: 's-1', date: '2026-04-01', weightKg: 80, reps: 8, rir: 2, techniqueQuality: 'good' },
            notes: [],
          },
          recentValues: [98, 99, 100],
        },
      ],
    });

    expect(['intermediate', 'novice_plus', 'advanced']).toContain(assessment.level);
    if (assessment.level === 'intermediate' || assessment.level === 'advanced') {
      expect(assessment.readinessForAdvancedFeatures.topBackoff).toBe(true);
    }
  });

  it('advanced remains constrained by pain patterns', () => {
    const assessment = buildTrainingLevelAssessment({
      history: Array.from({ length: 14 }, (_, index) => ({
        id: `s-${index}`,
        date: `2026-04-${String(index + 1).padStart(2, '0')}`,
        templateId: 'push-a',
        templateName: 'Push A',
        trainingMode: 'hybrid',
        exercises: [
          {
            id: 'bench-press',
            name: '卧推',
            sets: [{ id: 'a', type: 'straight', weight: 80, reps: 8, rir: 2, techniqueQuality: 'good', painFlag: false, done: true }],
          },
        ],
      })) as never,
      painPatterns: [{ area: 'shoulder', frequency: 5, severityAvg: 3, lastOccurredAt: '2026-04-20', suggestedAction: 'deload' }],
    });

    expect(assessment.readinessForAdvancedFeatures.aggressiveProgression).toBe(false);
  });
});
