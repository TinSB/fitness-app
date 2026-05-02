import { describe, expect, it } from 'vitest';
import { repairImportedAppData } from '../src/engines/dataRepairEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const dirtyData = () => {
  const session = makeSession({
    id: 'repair-identity-session',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 120, reps: 3, rir: 1, techniqueQuality: 'good' }],
  });
  session.exercises[0] = {
    ...session.exercises[0],
    originalExerciseId: 'bench-press',
    actualExerciseId: 'old-library-alt',
    replacementExerciseId: '__alt_bench',
  };
  return makeAppData({ history: [session] });
};

describe('data repair identity persistence', () => {
  it('preserves invalid identity as legacy through repair and sanitize', () => {
    const result = repairImportedAppData(clone(dirtyData()), {
      repairDate: '2026-05-01',
      sourceFileName: 'anonymous.json',
      maxRepairLogEntries: 200,
    });
    const repairedExercise = result.repairedData.history[0].exercises[0];

    expect(repairedExercise.actualExerciseId).toBeUndefined();
    expect(repairedExercise.replacementExerciseId).toBeUndefined();
    expect(repairedExercise.legacyActualExerciseId).toBe('old-library-alt');
    expect(repairedExercise.legacyReplacementExerciseId).toBe('__alt_bench');
    expect(repairedExercise.identityInvalid).toBe(true);

    const loadedAgain = sanitizeData(JSON.parse(JSON.stringify(result.repairedData)));
    expect(loadedAgain.history[0].exercises[0].legacyActualExerciseId).toBe('old-library-alt');
    expect(loadedAgain.history[0].exercises[0].actualExerciseId).toBeUndefined();
  });

  it('writes bounded repair log snippets without full session payloads', () => {
    const result = repairImportedAppData(clone(dirtyData()), {
      repairDate: '2026-05-01',
      sourceFileName: 'anonymous.json',
      maxRepairLogEntries: 200,
    });
    const logText = JSON.stringify(result.repairLog);

    expect(result.repairLog.some((entry) => entry.action.includes('legacy'))).toBe(true);
    expect(logText).toContain('old-library-alt');
    expect(logText).not.toContain('"exercises"');
    expect(logText).not.toContain('"history"');
    expect(result.repairLog.length).toBeLessThanOrEqual(200);
  });
});
