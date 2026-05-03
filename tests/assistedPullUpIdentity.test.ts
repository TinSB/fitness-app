import { describe, expect, it } from 'vitest';
import { EXERCISE_KNOWLEDGE_OVERRIDES } from '../src/data/exerciseLibrary';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { validateReplacementExerciseId } from '../src/engines/replacementEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

describe('assisted-pull-up identity', () => {
  it('is a stable known exercise id after sanitize/load boundaries', () => {
    const session = makeSession({
      id: 'assisted-identity-session',
      date: '2026-05-02',
      templateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      setSpecs: [{ weight: 35, reps: 10 }],
    });
    session.exercises[0] = {
      ...session.exercises[0],
      id: 'assisted-pull-up',
      canonicalExerciseId: 'assisted-pull-up',
      actualExerciseId: 'assisted-pull-up',
      replacementExerciseId: 'assisted-pull-up',
      originalExerciseId: 'lat-pulldown',
    };

    const sanitized = sanitizeData(makeAppData({ history: [session] }));
    const exercise = sanitized.history[0].exercises[0];

    expect(validateReplacementExerciseId('assisted-pull-up')).toBe(true);
    expect(exercise.actualExerciseId).toBe('assisted-pull-up');
    expect(exercise.legacyActualExerciseId).toBeUndefined();
    expect(exercise.identityInvalid).not.toBe(true);
    expect(getExerciseRecordPoolId(exercise)).toBe('assisted-pull-up');
    expect(buildDataHealthReport(sanitized).issues.map((issue) => issue.title)).not.toContain('动作记录身份需要检查');
  });

  it('does not belong to the horizontal-pull equivalence chain', () => {
    const assisted = EXERCISE_KNOWLEDGE_OVERRIDES['assisted-pull-up'];
    const seated = EXERCISE_KNOWLEDGE_OVERRIDES['seated-row'];

    expect(assisted.equivalenceChainId).toBe('vertical-pull');
    expect(seated.equivalenceChainId).toBe('horizontal-pull');
    expect(assisted.equivalenceChainId).not.toBe(seated.equivalenceChainId);
  });
});
