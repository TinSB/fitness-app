import { describe, expect, it } from 'vitest';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import { formatReplacementCategory } from '../src/i18n/formatters';
import type { ExercisePrescription } from '../src/models/training-model';

const exercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '综合',
    kind: 'compound',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const visibleTextFor = (...ids: string[]) =>
  ids
    .flatMap((id) => buildReplacementOptions(exercise(id)))
    .map((option) => `${option.name} ${option.rankLabel} ${option.reason}`)
    .join(' ');

describe('replacement display integrity', () => {
  it('formats every replacement category in Chinese', () => {
    expect({
      priority: formatReplacementCategory('priority'),
      acceptable: formatReplacementCategory('acceptable'),
      angle: formatReplacementCategory('angle'),
      optional: formatReplacementCategory('optional'),
      equipment_fallback: formatReplacementCategory('equipment_fallback'),
      fatigue_reduction: formatReplacementCategory('fatigue_reduction'),
      compound_fallback: formatReplacementCategory('compound_fallback'),
      not_recommended: formatReplacementCategory('not_recommended'),
      avoid: formatReplacementCategory('avoid'),
    }).toEqual({
      priority: '优先',
      acceptable: '可接受',
      angle: '角度相近',
      optional: '可选',
      equipment_fallback: '器械不可用时',
      fatigue_reduction: '降低疲劳',
      compound_fallback: '复合动作替代',
      not_recommended: '不推荐',
      avoid: '不推荐',
    });
  });

  it('shows Chinese explanations for non-equivalent replacement categories', () => {
    const latPulldownOptions = buildReplacementOptions(exercise('lat-pulldown'));
    const machineRow = latPulldownOptions.find((option) => option.id === 'machine-row');
    const rdlOptions = buildReplacementOptions(exercise('romanian-deadlift'));
    const hipThrust = rdlOptions.find((option) => option.id === 'hip-thrust');
    const tricepsOptions = buildReplacementOptions(exercise('triceps-pushdown'));
    const assistedDip = tricepsOptions.find((option) => option.id === 'assisted-dip');

    expect(machineRow).toMatchObject({
      rank: 'equipment_fallback',
      rankLabel: '器械不可用时',
    });
    expect(machineRow?.reason).toContain('器械不可用时可选');
    expect(hipThrust).toMatchObject({
      rank: 'acceptable',
      rankLabel: '可接受',
    });
    expect(hipThrust?.reason).toContain('降低下背压力');
    expect(hipThrust?.reason).toContain('不是髋铰链完全等价');
    expect(assistedDip).toMatchObject({
      rank: 'compound_fallback',
      rankLabel: '复合动作替代',
    });
    expect(assistedDip?.reason).toContain('复合动作替代，疲劳成本更高，不是完全等价替代');
  });

  it('does not leak raw enums, empty values or synthetic ids in replacement copy', () => {
    const visibleText = visibleTextFor(
      'bench-press',
      'lat-pulldown',
      'romanian-deadlift',
      'face-pull',
      'shoulder-press',
      'triceps-pushdown'
    );

    expect(visibleText).toMatch(/[\u3400-\u9fff]/);
    expect(visibleText).not.toMatch(/priority|acceptable|optional|equipment_fallback|fatigue_reduction|compound_fallback|not_recommended|avoid/);
    expect(visibleText).not.toMatch(/undefined|null|未命名动作|__auto_alt|__alt_/);
  });
});
