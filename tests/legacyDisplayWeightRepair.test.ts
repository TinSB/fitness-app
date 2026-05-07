import { describe, expect, it } from 'vitest';
import { analyzeLegacyDisplayWeightRepairScope, repairLegacyDisplayWeights } from '../src/engines/dataHealthRepairEngine';
import type { AppData, TrainingSession, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5],
  customIncrementsLb: [5, 10],
};

const makeSession = (): TrainingSession => {
  const pull = getTemplate('pull-a');
  return {
    id: 'legacy-display-review',
    date: '2026-05-01',
    templateId: 'pull-a',
    templateName: pull.name,
    trainingMode: 'hybrid',
    completed: true,
    exercises: [
      {
        ...pull.exercises[0],
        sets: [
          {
            id: 'missing-actual',
            type: 'top',
            weight: 0,
            displayWeight: 95,
            displayUnit: 'lb',
            reps: 8,
            done: true,
          },
          {
            id: 'invalid-identity',
            type: 'backoff',
            weight: 40,
            actualWeightKg: 40,
            displayWeight: 88.2,
            displayUnit: 'lb',
            reps: 8,
            done: true,
            actualExerciseId: '__alt_legacy_pull',
            identityInvalid: true,
          },
        ],
      },
    ],
  };
};

const makeData = (): AppData => makeAppData({ unitSettings, history: [makeSession()] });

describe('legacy display weight review boundary', () => {
  it('does not infer actualWeightKg from legacy display fields', () => {
    const data = makeData();
    const result = repairLegacyDisplayWeights(data);
    const set = result.repairedData.history[0].exercises[0].sets[0];

    expect(result.repairedCount).toBe(0);
    expect(result.needsReviewCount).toBe(2);
    expect(set.actualWeightKg).toBeUndefined();
    expect(set.displayWeight).toBe(95);
    expect(set.displayUnit).toBe('lb');
    expect(result.warnings.join('\n')).toContain('需要复核');
  });

  it('keeps unsafe identity records for review instead of auto-cleaning display fields', () => {
    const data = makeData();
    const scope = analyzeLegacyDisplayWeightRepairScope(data);
    const result = repairLegacyDisplayWeights(data);
    const set = result.repairedData.history[0].exercises[0].sets[1];

    expect(scope).toEqual({ repairableCount: 0, needsReviewCount: 2 });
    expect(set.actualWeightKg).toBe(40);
    expect(set.displayWeight).toBe(88.2);
    expect(set.displayUnit).toBe('lb');
    expect(result.repairLog).toHaveLength(0);
  });
});
