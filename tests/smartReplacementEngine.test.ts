import { describe, expect, it } from 'vitest';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import type { PainPattern, ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeSession, templates } from './fixtures';

const benchPress = () => {
  const exercise = getTemplate('push-a').exercises.find((item) => item.id === 'bench-press');
  if (!exercise) throw new Error('Missing bench press fixture');
  return exercise;
};

const lowReadiness: ReadinessResult = {
  score: 48,
  level: 'low',
  trainingAdjustment: 'conservative',
  reasons: ['睡眠不足'],
};

const visibleText = (items: ReturnType<typeof buildSmartReplacementRecommendations>) =>
  items.flatMap((item) => [item.exerciseName, item.reason, ...item.warnings]).join('\n');

describe('smartReplacementEngine', () => {
  it('recommends dumbbell bench press and machine chest press as first-line bench replacements', () => {
    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
    });

    const primaryIds = recommendations.filter((item) => item.priority === 'primary').map((item) => item.exerciseId);

    expect(primaryIds).toEqual(expect.arrayContaining(['db-bench-press', 'machine-chest-press']));
    expect(recommendations[0].priority).toBe('primary');
    expect(visibleText(recommendations)).toContain('适合优先替代');
  });

  it('keeps incline dumbbell press as an angle variation', () => {
    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
    });

    expect(recommendations.find((item) => item.exerciseId === 'incline-db-press')?.priority).toBe('angle_variation');
  });

  it('does not treat triceps pushdown as a valid bench replacement', () => {
    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
    });
    const triceps = recommendations.find((item) => item.exerciseId === 'triceps-pushdown');

    expect(triceps?.priority).toBe('avoid');
    expect(recommendations.filter((item) => item.priority !== 'avoid').map((item) => item.exerciseId)).not.toContain('triceps-pushdown');
  });

  it('lowers priority when pain patterns match an otherwise close replacement', () => {
    const painPattern: PainPattern = {
      area: '胸',
      exerciseId: 'db-bench-press',
      frequency: 3,
      severityAvg: 4,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };

    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
      painPatterns: [painPattern],
    });
    const dumbbellBench = recommendations.find((item) => item.exerciseId === 'db-bench-press');

    expect(dumbbellBench?.priority).not.toBe('primary');
    expect(dumbbellBench?.warnings.join('\n')).toContain('不适');
  });

  it('prefers lower-fatigue options when readiness is low or load feedback is too heavy', () => {
    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
      readinessResult: lowReadiness,
      loadFeedback: { dominantFeedback: 'too_heavy' },
    });
    const machineIndex = recommendations.findIndex((item) => item.exerciseId === 'machine-chest-press');
    const dumbbellIndex = recommendations.findIndex((item) => item.exerciseId === 'db-bench-press');

    expect(machineIndex).toBeGreaterThanOrEqual(0);
    expect(dumbbellIndex).toBeGreaterThanOrEqual(0);
    expect(machineIndex).toBeLessThanOrEqual(dumbbellIndex);
    expect(recommendations.find((item) => item.exerciseId === 'machine-chest-press')?.reason).toContain('可控');
  });

  it('uses training history pain signals without mutating history', () => {
    const history = [
      makeSession({
        id: 'pain-history',
        date: '2026-04-28',
        templateId: 'push-a',
        exerciseId: 'machine-chest-press',
        setSpecs: [{ weight: 50, reps: 8, painFlag: true, painArea: '胸', painSeverity: 4 }],
      }),
    ];
    const before = JSON.stringify(history);

    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: benchPress(),
      exerciseLibrary: templates.flatMap((template) => template.exercises),
      trainingHistory: history,
    });

    expect(recommendations.find((item) => item.exerciseId === 'machine-chest-press')?.warnings.join('\n')).toContain('不适');
    expect(JSON.stringify(history)).toBe(before);
  });

  it('never generates synthetic ids and keeps visible text Chinese', () => {
    const recommendations = buildSmartReplacementRecommendations({
      currentExercise: {
        ...benchPress(),
        alternativeIds: ['db-bench-press', 'bench-press__auto_alt_alt', 'machine-chest-press'],
      },
      exerciseLibrary: templates.flatMap((template) => template.exercises),
      trainingLevel: 'unknown',
    });
    const text = visibleText(recommendations);

    expect(recommendations.map((item) => item.exerciseId).some((id) => id.includes('__'))).toBe(false);
    expect(text).not.toMatch(/\b(primary|secondary|angle_variation|avoid|undefined|null)\b/);
    expect(text).toMatch(/[替代动作训练疲劳]/);
  });
});

