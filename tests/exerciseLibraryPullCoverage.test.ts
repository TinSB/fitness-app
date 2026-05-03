import { describe, expect, it } from 'vitest';
import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  formatExerciseDisplayName,
} from '../src/data/exerciseLibrary';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { validateReplacementExerciseId } from '../src/engines/replacementEngine';
import { makeAppData, makeSession } from './fixtures';

const overrideOf = (id: string) => EXERCISE_KNOWLEDGE_OVERRIDES[id] as Record<string, unknown>;

describe('pull/back exercise library coverage', () => {
  it('registers assisted-pull-up as a valid vertical-pull exercise', () => {
    const assisted = overrideOf('assisted-pull-up');
    const verticalChain = EXERCISE_EQUIVALENCE_CHAINS['assisted-pull-up'];
    const horizontalChain = EXERCISE_EQUIVALENCE_CHAINS['seated-row'];

    expect(validateReplacementExerciseId('assisted-pull-up')).toBe(true);
    expect(formatExerciseDisplayName('assisted-pull-up')).toBe('辅助引体向上');
    expect(assisted).toMatchObject({
      canonicalExerciseId: 'assisted-pull-up',
      movementPattern: '垂直拉',
      equivalenceChainId: 'vertical-pull',
      fatigueCost: 'medium',
      skillDemand: 'medium',
    });
    expect(verticalChain.members).toContain('assisted-pull-up');
    expect(horizontalChain.members).not.toContain('assisted-pull-up');
  });

  it('does not report assisted-pull-up as invalid DataHealth legacy identity', () => {
    const session = makeSession({
      id: 'assisted-pull-up-session',
      date: '2026-05-02',
      templateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      setSpecs: [{ weight: 40, reps: 8 }],
    });
    session.exercises[0] = {
      ...session.exercises[0],
      id: 'assisted-pull-up',
      actualExerciseId: 'assisted-pull-up',
      canonicalExerciseId: 'assisted-pull-up',
      replacementExerciseId: 'assisted-pull-up',
      originalExerciseId: 'lat-pulldown',
    };

    const report = buildDataHealthReport(makeAppData({ history: [session] }));

    expect(report.issues.map((issue) => issue.title)).not.toContain('动作记录身份需要检查');
  });

  it('adds distinct Chinese display names for pull/back additions', () => {
    expect(EXERCISE_DISPLAY_NAMES['single-arm-lat-pulldown']).toBe('单臂高位下拉');
    expect(EXERCISE_DISPLAY_NAMES['machine-row']).toBe('器械划船');
    expect(EXERCISE_DISPLAY_NAMES['seated-row']).toBe('坐姿划船');
    expect(EXERCISE_DISPLAY_NAMES['chest-supported-row']).toBe('胸托划船');
    expect(EXERCISE_DISPLAY_NAMES['t-bar-row']).toBe('T 杠划船');
    expect(EXERCISE_DISPLAY_NAMES['reverse-pec-deck']).toBe('反向飞鸟');
    expect(EXERCISE_DISPLAY_NAMES['cable-rear-delt-fly']).toBe('绳索后束飞鸟');
    expect(new Set(['machine-row', 'seated-row', 'chest-supported-row'].map((id) => formatExerciseDisplayName(id))).size).toBe(3);
  });

  it('keeps rear-delt replacements shoulder/scapular focused instead of main back focused', () => {
    const facePull = overrideOf('face-pull');
    const reversePecDeck = overrideOf('reverse-pec-deck');
    const cableRearDeltFly = overrideOf('cable-rear-delt-fly');

    expect(facePull).toMatchObject({ primaryMuscles: ['肩'], equivalenceChainId: 'rear-delt-scapular' });
    expect(reversePecDeck).toMatchObject({ primaryMuscles: ['肩'], equivalenceChainId: 'rear-delt-scapular' });
    expect(cableRearDeltFly).toMatchObject({ primaryMuscles: ['肩'], equivalenceChainId: 'rear-delt-scapular' });
    expect((reversePecDeck.muscleContribution as Record<string, number>).背).toBeLessThan(0.5);
    expect((cableRearDeltFly.muscleContribution as Record<string, number>).背).toBeLessThan(0.5);
  });
});
