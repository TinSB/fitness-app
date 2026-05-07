import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { repairLegacyDisplayWeights } from '../src/engines/dataHealthRepairEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionVolume } from '../src/engines/engineUtils';
import type { AppData, TrainingSession, TrainingSetLog, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const lbUnitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5],
  customIncrementsLb: [5, 10],
};

const makeUnitDisplaySession = (): TrainingSession => {
  const pull = getTemplate('pull-a');
  return {
    id: 'session-weight-display-repair',
    date: '2026-05-01',
    templateId: 'pull-a',
    templateName: pull.name,
    programTemplateId: 'pull-a',
    trainingMode: 'hybrid',
    focus: pull.focus,
    completed: true,
    exercises: [
      {
        ...pull.exercises[0],
        sets: [
          {
            id: 'work-1',
            type: 'top',
            weight: 50,
            actualWeightKg: 52.6,
            displayWeight: 45.1,
            displayUnit: 'lb',
            reps: 8,
            rir: 2,
            done: true,
            techniqueQuality: 'good',
          },
          {
            id: 'work-review',
            type: 'backoff',
            weight: 0,
            displayWeight: 120,
            displayUnit: 'lb',
            reps: 10,
            rir: 2,
            done: true,
            techniqueQuality: 'good',
          },
        ],
      },
    ],
    focusWarmupSetLogs: [
      {
        id: 'warmup-1',
        type: 'warmup',
        weight: 20,
        actualWeightKg: 20.4,
        displayWeight: 35.2,
        displayUnit: 'lb',
        reps: 8,
        done: true,
      },
    ],
  };
};

const makeData = (): AppData =>
  makeAppData({
    unitSettings: lbUnitSettings,
    history: [makeUnitDisplaySession()],
    settings: { dataRepairLogs: [] },
  });

const collectActualWeightSnapshots = (data: AppData) =>
  (data.history || []).flatMap((session) => [
    ...(session.exercises || []).flatMap((exercise) =>
      (Array.isArray(exercise.sets) ? exercise.sets : []).map((set, setIndex) => ({
        path: `${session.id}/${exercise.id}/${set.id || setIndex}`,
        actualWeightKg: (set as TrainingSetLog).actualWeightKg,
      })),
    ),
    ...((session.focusWarmupSetLogs || []).map((set, setIndex) => ({
      path: `${session.id}/warmup/${set.id || setIndex}`,
      actualWeightKg: set.actualWeightKg,
    })) || []),
  ]);

const statSnapshot = (data: AppData) => ({
  volume: sessionVolume(data.history[0]),
  prs: buildPrs(data.history).map((item) => ({ exerciseId: item.exerciseId, metric: item.metric, value: item.value, raw: item.raw })),
  e1rm: buildE1RMProfile(data.history, 'lat-pulldown').best?.e1rmKg,
  effectiveSets: buildEffectiveVolumeSummary(data.history).effectiveSets,
});

describe('DataHealth legacy display weight repair', () => {
  it('cleans repairable display fields without changing actualWeightKg or training statistics', () => {
    const data = makeData();
    const beforeActualWeights = collectActualWeightSnapshots(data);
    const beforeStats = statSnapshot(data);

    const result = repairLegacyDisplayWeights(data, { repairedAt: '2026-05-07T12:00:00.000Z' });
    const repairedSession = result.repairedData.history[0];
    const repairedWorkingSet = repairedSession.exercises[0].sets[0];
    const reviewSet = repairedSession.exercises[0].sets[1];
    const repairedWarmup = repairedSession.focusWarmupSetLogs?.[0];

    expect(collectActualWeightSnapshots(result.repairedData)).toEqual(beforeActualWeights);
    expect(result.repairedCount).toBe(2);
    expect(result.needsReviewCount).toBe(1);
    expect(repairedWorkingSet.actualWeightKg).toBe(52.6);
    expect(repairedWorkingSet.displayWeight).toBeUndefined();
    expect(repairedWorkingSet.displayUnit).toBeUndefined();
    expect(repairedWarmup?.actualWeightKg).toBe(20.4);
    expect(repairedWarmup?.displayWeight).toBeUndefined();
    expect(repairedWarmup?.displayUnit).toBeUndefined();
    expect(reviewSet.actualWeightKg).toBeUndefined();
    expect(reviewSet.displayWeight).toBe(120);
    expect(reviewSet.displayUnit).toBe('lb');
    expect(statSnapshot(result.repairedData)).toEqual(beforeStats);
  });

  it('writes summary-only repair logs and reduces auto-fixable DataHealth issues', () => {
    const data = makeData();
    const beforeReport = buildDataHealthReport(data);
    const beforeRepairableCount = beforeReport.issues.filter((issue) => issue.category === 'unit' && issue.canAutoFix).length;

    const result = repairLegacyDisplayWeights(data, { repairedAt: '2026-05-07T12:00:00.000Z' });
    const afterReport = buildDataHealthReport(result.repairedData);
    const serializedLogs = JSON.stringify(result.repairLog);

    expect(beforeRepairableCount).toBeGreaterThan(0);
    expect(afterReport.issues.filter((issue) => issue.category === 'unit' && issue.canAutoFix)).toHaveLength(0);
    expect(afterReport.issues.some((issue) => issue.id.startsWith('display-weight-without-actual-kg'))).toBe(true);
    expect(result.repairLog).toHaveLength(2);
    result.repairLog.forEach((entry) => {
      expect(entry).toEqual(expect.objectContaining({
        repairId: entry.id,
        repairedAt: '2026-05-07T12:00:00.000Z',
        category: 'unit',
        action: '清理历史显示重量',
        beforeSummary: expect.stringContaining('旧显示'),
        afterSummary: expect.stringContaining('真实重量仍为'),
      }));
      expect(entry).not.toHaveProperty('before');
      expect(entry).not.toHaveProperty('after');
    });
    expect(serializedLogs).not.toMatch(/"history"\s*:/);
    expect(serializedLogs).not.toMatch(/"exercises"\s*:/);
    expect(serializedLogs).not.toMatch(/"sets"\s*:/);
    expect(serializedLogs).not.toMatch(/"session"\s*:/);
  });
});
