import { expect } from 'vitest';
import type { AppData, TrainingSession, TrainingSetLog, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';
import type { RecordDataHealthMutationResponse } from '../packages/contracts/src';

export const NOW = '2026-05-08T12:00:00.000Z';

export const lbUnitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5],
  customIncrementsLb: [5, 10],
};

export const makeRecordSession = (id = 'record-mutation-session'): TrainingSession => ({
  ...makeSession({
    id,
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 8, rir: 2, techniqueQuality: 'good' }],
  }),
  startedAt: '2026-05-04T14:00:00.000Z',
  finishedAt: '2026-05-04T14:45:00.000Z',
  dataFlag: 'normal',
});

export const makeRecordData = (session: TrainingSession = makeRecordSession()): AppData =>
  makeAppData({
    history: [session],
    settings: {
      dismissedDataHealthIssues: [],
      dataRepairLogs: [],
    },
  });

export const makeRepairableWeightData = (): AppData => {
  const pull = getTemplate('pull-a');
  return makeAppData({
    unitSettings: lbUnitSettings,
    history: [
      {
        id: 'repair-mutation-session',
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
                id: 'repair-mutation-set',
                type: 'top',
                weight: 52.6,
                actualWeightKg: 52.6,
                displayWeight: 45.1,
                displayUnit: 'lb',
                reps: 8,
                rir: 2,
                done: true,
                techniqueQuality: 'good',
              },
            ],
          },
        ],
        focusWarmupSetLogs: [
          {
            id: 'repair-mutation-warmup',
            exerciseId: pull.exercises[0].id,
            type: 'warmup',
            weight: 20.4,
            actualWeightKg: 20.4,
            displayWeight: 35.2,
            displayUnit: 'lb',
            reps: 8,
            done: true,
          },
        ],
      },
    ],
    settings: { dataRepairLogs: [] },
  });
};

export const makeNeedsReviewWeightData = (): AppData => {
  const pull = getTemplate('pull-a');
  return makeAppData({
    unitSettings: lbUnitSettings,
    history: [
      {
        id: 'repair-review-only-session',
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
                id: 'repair-review-only-set',
                type: 'top',
                weight: 0,
                displayWeight: 120,
                displayUnit: 'lb',
                reps: 8,
                rir: 2,
                done: true,
                techniqueQuality: 'good',
              },
            ],
          },
        ],
      },
    ],
    settings: { dataRepairLogs: [] },
  });
};

export const collectActualWeightSnapshots = (data: AppData) =>
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

export const expectNextDataRule = (apiResponse: RecordDataHealthMutationResponse) => {
  if (apiResponse.result.ok === true && apiResponse.result.changed === true) {
    expect(apiResponse.nextData).toBeDefined();
  } else {
    expect(apiResponse.nextData).toBeUndefined();
  }
};

export const expectNoNextData = (apiResponse: RecordDataHealthMutationResponse) => {
  expect(apiResponse.nextData).toBeUndefined();
  expectNextDataRule(apiResponse);
};
