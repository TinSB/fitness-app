import { describe, expect, it } from 'vitest';
import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  formatExerciseDisplayName,
} from '../src/data/exerciseLibrary';
import { validateReplacementExerciseId } from '../src/engines/replacementEngine';

const metadata = (id: string) => EXERCISE_KNOWLEDGE_OVERRIDES[id] as Record<string, unknown>;

describe('leg exercise library coverage', () => {
  it('registers all Legs V1 exercises with Chinese display names', () => {
    const expectedNames: Record<string, string> = {
      'smith-squat': '史密斯深蹲',
      'belt-squat': '腰带深蹲',
      'goblet-squat': '高脚杯深蹲',
      'seated-leg-curl': '坐姿腿弯举',
      'lying-leg-curl': '俯卧腿弯举',
      'nordic-curl': '北欧腿弯举',
      'seated-calf-raise': '坐姿提踵',
      'standing-calf-raise': '站姿提踵',
      'leg-press-calf-raise': '腿举机提踵',
    };

    Object.entries(expectedNames).forEach(([id, name]) => {
      expect(validateReplacementExerciseId(id)).toBe(true);
      expect(EXERCISE_DISPLAY_NAMES[id]).toBe(name);
      expect(formatExerciseDisplayName(id)).toBe(name);
      expect(formatExerciseDisplayName(id)).not.toMatch(/undefined|null|Smith|Belt|Curl|Calf|Raise/);
    });
  });

  it('keeps squat, hinge, knee-flexion and calf chains separated', () => {
    const squatChain = EXERCISE_EQUIVALENCE_CHAINS.squat.members;
    const hingeChain = EXERCISE_EQUIVALENCE_CHAINS['romanian-deadlift'].members;
    const legCurlChain = EXERCISE_EQUIVALENCE_CHAINS['leg-curl'].members;
    const calfChain = EXERCISE_EQUIVALENCE_CHAINS['calf-raise'].members;

    expect(squatChain).toEqual(['squat', 'hack-squat', 'smith-squat', 'leg-press', 'belt-squat', 'goblet-squat']);
    expect(hingeChain).toEqual(['romanian-deadlift', 'db-rdl', 'hip-thrust']);
    expect(legCurlChain).toEqual(['leg-curl', 'seated-leg-curl', 'lying-leg-curl', 'nordic-curl']);
    expect(calfChain).toEqual(['calf-raise', 'seated-calf-raise', 'standing-calf-raise', 'leg-press-calf-raise']);
    expect(squatChain).not.toEqual(expect.arrayContaining(['leg-curl', 'calf-raise', 'seated-calf-raise']));
    expect(hingeChain).not.toEqual(expect.arrayContaining(['leg-curl', 'calf-raise']));
    expect(calfChain).not.toEqual(expect.arrayContaining(['squat', 'romanian-deadlift', 'leg-curl']));
  });

  it('stores appropriate metadata for high-skill knee flexion and calf variants', () => {
    expect(metadata('nordic-curl')).toMatchObject({
      movementPattern: '膝屈',
      fatigueCost: 'high',
      skillDemand: 'high',
      equivalenceChainId: 'leg-curl',
    });
    expect(metadata('seated-calf-raise')).toMatchObject({
      movementPattern: '跖屈',
      fatigueCost: 'low',
      skillDemand: 'low',
      equivalenceChainId: 'calf-raise',
    });
    expect(metadata('leg-press-calf-raise')).toMatchObject({
      movementPattern: '跖屈',
      equivalenceChainId: 'calf-raise',
    });
  });

  it('keeps hip-thrust as hip extension rather than an RDL priority equivalent', () => {
    const hipThrust = metadata('hip-thrust');
    const rdlPriorities = metadata('romanian-deadlift').alternativePriorities as Record<string, string>;

    expect(hipThrust).toMatchObject({
      canonicalExerciseId: 'hip-thrust',
      movementPattern: '髋伸',
      equivalenceChainId: 'hinge-pattern',
    });
    expect(rdlPriorities['db-rdl']).toBe('priority');
    expect(rdlPriorities['hip-thrust']).toBe('acceptable');
    expect(rdlPriorities['hip-thrust']).not.toBe('priority');
  });
});
