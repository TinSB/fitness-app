import { describe, expect, it } from 'vitest';
import { EXERCISE_DISPLAY_NAMES, formatExerciseDisplayName } from '../src/data/exerciseLibrary';
import { SUPPORT_EXERCISE_LIBRARY } from '../src/data/supportExerciseLibrary';

describe('exercise name i18n', () => {
  it('keeps every library exercise user-facing name in Chinese', () => {
    Object.entries(EXERCISE_DISPLAY_NAMES).forEach(([id, name]) => {
      expect(name, id).toMatch(/[\u3400-\u9fff]/);
    });
    SUPPORT_EXERCISE_LIBRARY.forEach((exercise) => {
      expect(exercise.name, exercise.id).toMatch(/[\u3400-\u9fff]/);
    });
  });

  it('shows Chinese by default and bilingual text only as an explicit option', () => {
    expect(formatExerciseDisplayName('db-bench-press')).toBe('哑铃卧推');
    expect(formatExerciseDisplayName('db-bench-press', { bilingual: true })).toBe('哑铃卧推（Dumbbell Bench Press）');
  });

  it('does not expose a pure English fallback when Chinese is missing', () => {
    expect(formatExerciseDisplayName({ id: 'unknown-lift', name: 'Unknown Lift' })).toBe('未命名动作');
  });
});
