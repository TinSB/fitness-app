import { describe, expect, it } from 'vitest';
import {
  EXERCISE_ALIASES,
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  formatExerciseDisplayName,
  resolveExerciseReferenceToId,
} from '../src/data/exerciseLibrary';
import { isKnownExerciseId } from '../src/engines/replacementEngine';

const metadata = (id: string) => EXERCISE_KNOWLEDGE_OVERRIDES[id] as Record<string, unknown>;

describe('shoulder and arm exercise library coverage', () => {
  it('adds shoulder exercises with distinct Chinese names and separated chains', () => {
    expect(formatExerciseDisplayName('machine-shoulder-press')).toBe('器械肩推');
    expect(formatExerciseDisplayName('smith-shoulder-press')).toBe('史密斯肩推');
    expect(formatExerciseDisplayName('landmine-press')).toBe('地雷管推举');
    expect(formatExerciseDisplayName('cable-lateral-raise')).toBe('绳索侧平举');
    expect(formatExerciseDisplayName('machine-lateral-raise')).toBe('器械侧平举');
    expect(formatExerciseDisplayName('rear-delt-raise')).toBe('俯身后束飞鸟');

    expect(metadata('shoulder-press').equivalenceChainId).toBe('vertical-press');
    expect(metadata('lateral-raise').equivalenceChainId).toBe('lateral-raise');
    expect(metadata('rear-delt-raise').equivalenceChainId).toBe('rear-delt');
    expect(EXERCISE_EQUIVALENCE_CHAINS['shoulder-press'].members).toEqual([
      'shoulder-press',
      'machine-shoulder-press',
      'smith-shoulder-press',
      'landmine-press',
    ]);
    expect(EXERCISE_EQUIVALENCE_CHAINS['lateral-raise'].members).toEqual([
      'lateral-raise',
      'cable-lateral-raise',
      'machine-lateral-raise',
    ]);
  });

  it('keeps rear-delt display names distinct', () => {
    expect(formatExerciseDisplayName('rear-delt-raise')).toBe('俯身后束飞鸟');
    expect(formatExerciseDisplayName('reverse-pec-deck')).toBe('反向飞鸟');
    expect(formatExerciseDisplayName('cable-rear-delt-fly')).toBe('绳索后束飞鸟');
    expect(new Set(['rear-delt-raise', 'reverse-pec-deck', 'cable-rear-delt-fly'].map((id) => formatExerciseDisplayName(id))).size).toBe(3);
  });

  it('adds biceps and triceps variants without creating a duplicate rope pushdown identity', () => {
    expect(formatExerciseDisplayName('ez-bar-curl')).toBe('EZ 杠弯举');
    expect(formatExerciseDisplayName('preacher-curl')).toBe('牧师凳弯举');
    expect(formatExerciseDisplayName('cable-curl')).toBe('绳索弯举');
    expect(formatExerciseDisplayName('incline-db-curl')).toBe('上斜哑铃弯举');
    expect(formatExerciseDisplayName('rope-hammer-curl')).toBe('绳索锤式弯举');
    expect(formatExerciseDisplayName('triceps-pushdown')).toBe('绳索下压');
    expect(formatExerciseDisplayName('straight-bar-pushdown')).toBe('直杆下压');
    expect(formatExerciseDisplayName('overhead-cable-triceps-extension')).toBe('绳索过顶臂屈伸');
    expect(formatExerciseDisplayName('skull-crusher')).toBe('仰卧臂屈伸');

    expect(EXERCISE_DISPLAY_NAMES['rope-triceps-pushdown']).toBeUndefined();
    expect(EXERCISE_ALIASES['triceps-pushdown']).toEqual(expect.arrayContaining(['绳索下压', '三头下压']));
    expect(isKnownExerciseId('rope-triceps-pushdown')).toBe(false);
    expect(resolveExerciseReferenceToId('绳索下压')).toBe('triceps-pushdown');
  });

  it('uses valid exercise ids and does not expose undefined display copy', () => {
    const ids = [
      'smith-shoulder-press',
      'cable-lateral-raise',
      'machine-lateral-raise',
      'rear-delt-raise',
      'ez-bar-curl',
      'cable-curl',
      'incline-db-curl',
      'rope-hammer-curl',
      'straight-bar-pushdown',
      'overhead-cable-triceps-extension',
      'skull-crusher',
      'assisted-dip',
    ];

    expect(ids.every((id) => isKnownExerciseId(id))).toBe(true);
    expect(ids.map((id) => formatExerciseDisplayName(id)).join(' ')).not.toMatch(/undefined|null|__alt_|rope-triceps-pushdown/);
  });
});
