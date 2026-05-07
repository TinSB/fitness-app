import { describe, expect, it } from 'vitest';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
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

describe('replacement equipment display', () => {
  it('adds short Chinese equipment reasons without raw tags', () => {
    const incline = buildReplacementOptions(exercise('incline-db-press'), { unavailableEquipment: ['dumbbell'] });
    const smithIncline = incline.find((option) => option.id === 'smith-incline-press');
    const cableFly = buildReplacementOptions(exercise('cable-fly'), { unavailableEquipment: ['cable'] });
    const pecDeck = cableFly.find((option) => option.id === 'pec-deck-fly');
    const squat = buildReplacementOptions(exercise('squat'), { unavailableEquipment: ['rack', 'barbell'] });
    const hackSquat = squat.find((option) => option.id === 'hack-squat');

    expect(smithIncline?.reason).toContain('避开哑铃区');
    expect(smithIncline?.reason).toContain('可在固定器械区完成');
    expect(pecDeck?.reason).toContain('不依赖绳索');
    expect(hackSquat?.reason).toContain('不需要深蹲架');

    const text = [smithIncline?.reason, pecDeck?.reason, hackSquat?.reason].join(' ');
    expect(text).not.toMatch(/dumbbell|cable|rack|barbell|equipment_fallback|undefined|null|__alt_/);
  });

  it('marks unavailable-dependent options as lowered instead of deleting them', () => {
    const options = buildReplacementOptions(exercise('triceps-pushdown'), { unavailableEquipment: ['cable'] });
    const straightBar = options.find((option) => option.id === 'straight-bar-pushdown');
    const skullCrusher = options.find((option) => option.id === 'skull-crusher');
    const assistedDip = options.find((option) => option.id === 'assisted-dip');

    expect(straightBar).toMatchObject({ rank: 'priority' });
    expect(straightBar?.reason).toContain('需要绳索区，已降低排序');
    expect(skullCrusher?.reason).toContain('不依赖绳索');
    expect(assistedDip?.reason).toContain('复合动作替代，疲劳成本更高，不是完全等价替代');
  });
});
