import { describe, expect, it } from 'vitest';
import { formatExerciseDisplayName } from '../src/data/exerciseLibrary';
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
    muscle: '手臂',
    kind: 'isolation',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 90,
    startWeight: 12,
  }) as ExercisePrescription;

describe('shoulder and arm replacement display', () => {
  it('formats replacement categories including compound fallback in Chinese', () => {
    const labels = {
      priority: formatReplacementCategory('priority'),
      acceptable: formatReplacementCategory('acceptable'),
      optional: formatReplacementCategory('optional'),
      compound_fallback: formatReplacementCategory('compound_fallback'),
      not_recommended: formatReplacementCategory('not_recommended'),
    };

    expect(labels).toEqual({
      priority: '优先',
      acceptable: '可接受',
      optional: '可选',
      compound_fallback: '复合动作替代',
      not_recommended: '不推荐',
    });
    expect(Object.values(labels).join(' ')).not.toMatch(/priority|acceptable|optional|compound_fallback|not_recommended|undefined|null/);
  });

  it('uses clear Chinese names for shoulder and arm exercises', () => {
    const labels = [
      'machine-shoulder-press',
      'smith-shoulder-press',
      'landmine-press',
      'cable-lateral-raise',
      'machine-lateral-raise',
      'rear-delt-raise',
      'ez-bar-curl',
      'preacher-curl',
      'cable-curl',
      'incline-db-curl',
      'rope-hammer-curl',
      'triceps-pushdown',
      'straight-bar-pushdown',
      'overhead-cable-triceps-extension',
      'skull-crusher',
      'assisted-dip',
    ].map((id) => formatExerciseDisplayName(id));

    expect(labels).toEqual([
      '器械肩推',
      '史密斯肩推',
      '地雷管推举',
      '绳索侧平举',
      '器械侧平举',
      '俯身后束飞鸟',
      'EZ 杠弯举',
      '牧师凳弯举',
      '绳索弯举',
      '上斜哑铃弯举',
      '绳索锤式弯举',
      '绳索下压',
      '直杆下压',
      '绳索过顶臂屈伸',
      '仰卧臂屈伸',
      '辅助双杠臂屈伸',
    ]);
    expect(labels.join(' ')).not.toMatch(/undefined|null|rope-triceps-pushdown|__alt_/);
  });

  it('does not leak raw enum or internal ids in visible replacement option copy', () => {
    const visibleText = [
      ...buildReplacementOptions(exercise('shoulder-press')),
      ...buildReplacementOptions(exercise('lateral-raise')),
      ...buildReplacementOptions(exercise('db-curl')),
      ...buildReplacementOptions(exercise('hammer-curl')),
      ...buildReplacementOptions(exercise('triceps-pushdown')),
    ]
      .map((option) => `${option.name} ${option.rankLabel} ${option.reason}`)
      .join(' ');

    expect(visibleText).toContain('地雷管推举');
    expect(visibleText).toContain('不是垂直推完全等价替代');
    expect(visibleText).toContain('握法侧重点不同');
    expect(visibleText).toContain('复合推类替代，疲劳成本更高，不是孤立下压等价替代');
    expect(visibleText).not.toMatch(/priority|acceptable|optional|compound_fallback|not_recommended|rope-triceps-pushdown|undefined|null|__alt_/);
  });
});
