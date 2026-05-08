import { describe, expect, it } from 'vitest';
import { buildReplacementDisplayGroups } from '../src/features/TrainingFocusView';
import type { SmartReplacementRecommendation } from '../src/engines/smartReplacementEngine';

const option = (exerciseId: string, priority: SmartReplacementRecommendation['priority']): SmartReplacementRecommendation => ({
  exerciseId,
  exerciseName: exerciseId,
  priority,
  fatigueCost: 'medium',
  reason: '可作为本次替代选择。',
  warnings: [],
});

const ids = (options: SmartReplacementRecommendation[]) => options.map((item) => item.exerciseId);

describe('replacement BottomSheet display grouping', () => {
  it('groups only the first one or two highest-priority visible candidates as top recommendations', () => {
    const options = [
      option('smith-incline-press', 'primary'),
      option('machine-incline-chest-press', 'primary'),
      option('machine-chest-press', 'primary'),
      option('db-bench-press', 'secondary'),
      option('assisted-dip', 'angle_variation'),
    ];

    const groups = buildReplacementDisplayGroups(options);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ key: 'top', title: '推荐优先' });
    expect(ids(groups[0].options)).toEqual(['smith-incline-press', 'machine-incline-chest-press']);
    expect(groups[1]).toMatchObject({ key: 'other', title: '其他可选' });
    expect(ids(groups[1].options)).toEqual(['machine-chest-press', 'db-bench-press', 'assisted-dip']);
    expect(ids(groups.flatMap((group) => group.options))).toEqual(ids(options));
  });

  it('does not reorder candidates inside display groups or mutate the original options', () => {
    const options = [
      option('db-fly', 'secondary'),
      option('pec-deck-fly', 'secondary'),
      option('machine-chest-press', 'angle_variation'),
    ];
    const before = [...options];

    const groups = buildReplacementDisplayGroups(options);

    expect(options).toEqual(before);
    expect(ids(groups[0].options)).toEqual(['db-fly', 'pec-deck-fly']);
    expect(ids(groups[1].options)).toEqual(['machine-chest-press']);
  });

  it('does not force headings when there is only one candidate', () => {
    const groups = buildReplacementDisplayGroups([option('chest-supported-row', 'primary')]);

    expect(groups).toEqual([
      {
        key: 'all',
        options: [option('chest-supported-row', 'primary')],
      },
    ]);
  });
});
