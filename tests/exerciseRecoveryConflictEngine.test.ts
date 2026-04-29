import { describe, expect, it } from 'vitest';
import {
  buildExerciseRecoveryConflict,
  type ExerciseRecoveryConflictLevel,
} from '../src/engines/exerciseRecoveryConflictEngine';
import type { ExerciseTemplate } from '../src/models/training-model';
import { templates } from './fixtures';

const exercise = (id: string): ExerciseTemplate => {
  const found = templates.flatMap((template) => template.exercises).find((item) => item.id === id);
  if (!found) throw new Error(`Missing exercise fixture: ${id}`);
  return found as ExerciseTemplate;
};

const levelRank: Record<ExerciseRecoveryConflictLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

const visibleText = (result: ReturnType<typeof buildExerciseRecoveryConflict>) =>
  [result.exerciseName, result.reason, ...result.affectedAreas].join('\n');

const expectNoRawVisibleText = (text: string) => {
  expect(text).not.toMatch(/\b(none|low|moderate|high|keep|reduce_intensity|reduce_volume|substitute|skip|undefined|null)\b/);
};

describe('exerciseRecoveryConflictEngine', () => {
  it('scores back soreness against Romanian deadlift as moderate or high', () => {
    const result = buildExerciseRecoveryConflict({
      exercise: exercise('romanian-deadlift'),
      sorenessAreas: ['背部'],
    });

    expect(['moderate', 'high']).toContain(result.conflictLevel);
    expect(result.affectedAreas).toContain('背部');
    expect(result.reason).toContain('背部酸痛');
  });

  it('scores back soreness against leg press as none or low', () => {
    const result = buildExerciseRecoveryConflict({
      exercise: exercise('leg-press'),
      sorenessAreas: ['背部'],
    });

    expect(['none', 'low']).toContain(result.conflictLevel);
    expect(result.reason).toMatch(/[一-龥]/);
  });

  it('scores back soreness against leg curl as none or low', () => {
    const result = buildExerciseRecoveryConflict({
      exercise: exercise('leg-curl'),
      sorenessAreas: ['背部'],
    });

    expect(['none', 'low']).toContain(result.conflictLevel);
  });

  it('scores back soreness against calf raise as none', () => {
    const result = buildExerciseRecoveryConflict({
      exercise: exercise('calf-raise'),
      sorenessAreas: ['背部'],
    });

    expect(result.conflictLevel).toBe('none');
    expect(result.recommendedAction).toBe('keep');
  });

  it('scores shoulder soreness against upper-body presses as moderate or high', () => {
    const bench = buildExerciseRecoveryConflict({
      exercise: exercise('bench-press'),
      sorenessAreas: ['肩部'],
    });
    const shoulderPress = buildExerciseRecoveryConflict({
      exercise: exercise('shoulder-press'),
      sorenessAreas: ['肩部'],
    });

    expect(['moderate', 'high']).toContain(bench.conflictLevel);
    expect(['moderate', 'high']).toContain(shoulderPress.conflictLevel);
  });

  it('scores shoulder soreness against leg movements as low or none', () => {
    const legPress = buildExerciseRecoveryConflict({
      exercise: exercise('leg-press'),
      sorenessAreas: ['肩部'],
    });
    const legCurl = buildExerciseRecoveryConflict({
      exercise: exercise('leg-curl'),
      sorenessAreas: ['肩部'],
    });
    const calfRaise = buildExerciseRecoveryConflict({
      exercise: exercise('calf-raise'),
      sorenessAreas: ['肩部'],
    });

    expect(['none', 'low']).toContain(legPress.conflictLevel);
    expect(['none', 'low']).toContain(legCurl.conflictLevel);
    expect(['none', 'low']).toContain(calfRaise.conflictLevel);
  });

  it('scores pain higher than soreness for the same exercise', () => {
    const soreness = buildExerciseRecoveryConflict({
      exercise: exercise('squat'),
      sorenessAreas: ['背部'],
    });
    const pain = buildExerciseRecoveryConflict({
      exercise: exercise('squat'),
      painAreas: ['背部'],
    });

    expect(levelRank[pain.conflictLevel]).toBeGreaterThan(levelRank[soreness.conflictLevel]);
  });

  it('returns Chinese reasons without raw enum text', () => {
    const result = buildExerciseRecoveryConflict({
      exercise: exercise('bench-press'),
      sorenessAreas: ['胸部'],
    });
    const text = visibleText(result);

    expect(text).toMatch(/[一-龥]/);
    expectNoRawVisibleText(text);
  });
});
