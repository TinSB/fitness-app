import { describe, expect, it } from 'vitest';
import { formatExerciseDisplayName } from '../src/data/exerciseLibrary';
import { formatReplacementCategory } from '../src/i18n/formatters';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import type { ExercisePrescription } from '../src/models/training-model';

const exercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '腿',
    kind: 'compound',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

describe('leg replacement display', () => {
  it('formats leg replacement categories in Chinese', () => {
    const labels = [
      formatReplacementCategory('priority'),
      formatReplacementCategory('acceptable'),
      formatReplacementCategory('optional'),
      formatReplacementCategory('fatigue_reduction'),
      formatReplacementCategory('not_recommended'),
    ];

    expect(labels).toEqual(['优先', '可接受', '可选', '降低疲劳', '不推荐']);
    expect(labels.join(' ')).not.toMatch(/priority|acceptable|optional|fatigue_reduction|not_recommended|undefined|null/);
  });

  it('uses Chinese names for all added leg exercises', () => {
    const labels = [
      'smith-squat',
      'belt-squat',
      'goblet-squat',
      'seated-leg-curl',
      'lying-leg-curl',
      'nordic-curl',
      'seated-calf-raise',
      'standing-calf-raise',
      'leg-press-calf-raise',
    ].map((id) => formatExerciseDisplayName(id));

    expect(labels).toEqual(['史密斯深蹲', '腰带深蹲', '高脚杯深蹲', '坐姿腿弯举', '俯卧腿弯举', '北欧腿弯举', '坐姿提踵', '站姿提踵', '腿举机提踵']);
    expect(labels.join(' ')).not.toMatch(/Smith|Belt|Goblet|Curl|Calf|Raise|undefined|null/);
  });

  it('does not leak raw enum or English names in visible replacement option copy', () => {
    const visibleText = [
      ...buildReplacementOptions(exercise('squat')),
      ...buildReplacementOptions(exercise('romanian-deadlift')),
      ...buildReplacementOptions(exercise('leg-curl')),
      ...buildReplacementOptions(exercise('calf-raise')),
    ]
      .map((option) => `${option.name} ${option.rankLabel} ${option.reason}`)
      .join(' ');

    expect(visibleText).toContain('史密斯深蹲');
    expect(visibleText).toContain('臀推更偏髋伸和臀腿后链');
    expect(visibleText).toContain('腿后侧补量');
    expect(visibleText).not.toMatch(/acceptable|optional|fatigue_reduction|not_recommended|undefined|null|__alt_/);
  });
});
