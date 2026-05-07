import { describe, expect, it } from 'vitest';
import { applyExerciseReplacement, buildReplacementOptions } from '../src/engines/replacementEngine';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';

const exercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '综合',
    kind: 'compound',
    sets: [{ id: `${id}-1`, type: 'working', weight: 40, reps: 10, rir: 2, done: true }],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const sessionWith = (id: string): TrainingSession =>
  ({
    id: `${id}-session`,
    date: '2026-05-05',
    templateId: 'context-isolation',
    templateName: 'Context Isolation',
    trainingMode: 'hybrid',
    completed: false,
    exercises: [exercise(id)],
  }) as TrainingSession;

describe('replacement equipment context isolation', () => {
  it('keeps unavailable equipment out of session, set logs and history-shaped data', () => {
    const selected = buildReplacementOptions(exercise('incline-db-press'), { unavailableEquipment: ['dumbbell'] })[0];
    const replaced = applyExerciseReplacement(sessionWith('incline-db-press'), 0, selected.id);
    const serialized = JSON.stringify(replaced);

    expect(selected.id).toBe('smith-incline-press');
    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(serialized).not.toMatch(/unavailableEquipment|selectedUnavailableEquipment|replacementEquipmentChips|dumbbell|器械被占用/);
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('smith-incline-press');
  });

  it('does not let temporary equipment context change the actual exercise record pool', () => {
    const selected = buildReplacementOptions(exercise('triceps-pushdown'), { unavailableEquipment: ['cable'] }).find((option) => option.id === 'assisted-dip');
    const replaced = applyExerciseReplacement(sessionWith('triceps-pushdown'), 0, selected?.id || 'assisted-dip');

    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('assisted-dip');
    expect(JSON.stringify(replaced)).not.toMatch(/unavailableEquipment|cable|绳索区/);
  });
});
