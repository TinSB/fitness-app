import { describe, expect, it } from 'vitest';
import { repairLegacyDisplayWeights } from '../src/engines/dataHealthRepairEngine';
import { formatRecordSetWeightForDisplay } from '../src/features/RecordView';
import type { AppData, TrainingSetLog, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const lbUnitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5],
  customIncrementsLb: [5, 10],
};

const makeData = (): AppData => {
  const push = getTemplate('push-a');
  return makeAppData({
    unitSettings: lbUnitSettings,
    history: [
      {
        id: 'record-display-session',
        date: '2026-05-01',
        templateId: 'push-a',
        templateName: push.name,
        trainingMode: 'hybrid',
        completed: true,
        exercises: [
          {
            ...push.exercises[0],
            sets: [
              {
                id: 'actual-source-set',
                type: 'top',
                weight: 52.6,
                actualWeightKg: 52.6,
                displayWeight: 45.1,
                displayUnit: 'lb',
                reps: 8,
                rir: 2,
                done: true,
              },
              {
                id: 'needs-review-set',
                type: 'backoff',
                weight: 0,
                displayWeight: 45.1,
                displayUnit: 'lb',
                reps: 10,
                done: true,
              },
            ],
          },
        ],
      },
    ],
  });
};

describe('Record weight display after legacy display repair', () => {
  it('uses actualWeightKg and current unit settings instead of stale displayWeight when actualWeightKg exists', () => {
    const data = makeData();
    const set = data.history[0].exercises[0].sets[0] as TrainingSetLog;
    const text = formatRecordSetWeightForDisplay(set, lbUnitSettings);

    expect(text).toBe('116lb');
    expect(text).not.toContain('45.1');
    expect(text).not.toMatch(/undefined|null/);
  });

  it('keeps legacy display only as a review fallback when actualWeightKg is missing', () => {
    const data = makeData();
    const set = data.history[0].exercises[0].sets[1] as TrainingSetLog;
    const text = formatRecordSetWeightForDisplay(set, lbUnitSettings);

    expect(text).toBe('45.1lb（需要复核）');
    expect(text).toContain('需要复核');
    expect(set.actualWeightKg).toBeUndefined();
  });

  it('does not show stale lb decimals after repair when actualWeightKg is present', () => {
    const result = repairLegacyDisplayWeights(makeData(), { repairedAt: '2026-05-07T12:00:00.000Z' });
    const set = result.repairedData.history[0].exercises[0].sets[0] as TrainingSetLog;
    const text = formatRecordSetWeightForDisplay(set, lbUnitSettings);

    expect(set.actualWeightKg).toBe(52.6);
    expect(set.displayWeight).toBeUndefined();
    expect(text).toBe('116lb');
    expect(text).not.toContain('45.1');
  });
});
