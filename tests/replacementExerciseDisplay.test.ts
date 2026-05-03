import { describe, expect, it } from 'vitest';
import { formatExerciseDisplayName } from '../src/data/exerciseLibrary';
import { formatReplacementCategory } from '../src/i18n/formatters';

describe('replacement exercise display', () => {
  it('keeps row machine names distinct for users', () => {
    expect(formatExerciseDisplayName('seated-row')).toBe('坐姿划船');
    expect(formatExerciseDisplayName('machine-row')).toBe('器械划船');
    expect(formatExerciseDisplayName('chest-supported-row')).toBe('胸托划船');
    expect(formatExerciseDisplayName('machine-row')).not.toBe(formatExerciseDisplayName('seated-row'));
    expect(formatExerciseDisplayName('machine-row')).not.toBe(formatExerciseDisplayName('chest-supported-row'));
  });

  it('formats every replacement priority in Chinese without raw enum leakage', () => {
    const labels = {
      priority: formatReplacementCategory('priority'),
      acceptable: formatReplacementCategory('acceptable'),
      angle: formatReplacementCategory('angle'),
      optional: formatReplacementCategory('optional'),
      equipment_fallback: formatReplacementCategory('equipment_fallback'),
      fatigue_reduction: formatReplacementCategory('fatigue_reduction'),
      not_recommended: formatReplacementCategory('not_recommended'),
    };

    expect(labels).toEqual({
      priority: '优先',
      acceptable: '可接受',
      angle: '角度相近',
      optional: '可选',
      equipment_fallback: '器械不可用时',
      fatigue_reduction: '降低疲劳',
      not_recommended: '不推荐',
    });
    expect(Object.values(labels).join(' ')).not.toMatch(/priority|acceptable|equipment_fallback|fatigue_reduction|not_recommended|undefined|null/);
  });
});
