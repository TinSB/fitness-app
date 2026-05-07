import { describe, expect, it } from 'vitest';
import assistedPullupFixture from './fixtures/realDataRegression/legacy-assisted-pullup-session.json';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import { STORAGE_VERSION } from '../src/data/trainingData';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { sessionVolume } from '../src/engines/engineUtils';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { AppData } from '../src/models/training-model';
import { sanitizeData, validateAppDataSchema } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

describe('schema migration compatibility', () => {
  it('sanitizes legacy todayStatus without a date and scopes soreness at decision time', () => {
    const sanitized = sanitizeData({
      ...makeAppData(),
      schemaVersion: 1,
      todayStatus: { sleep: '好', energy: '高', time: '60', soreness: ['背'] },
    });
    const context = buildTrainingDecisionContext(sanitized, '2026-05-04');

    expect(sanitized.schemaVersion).toBe(STORAGE_VERSION);
    expect(context.todayStatus).toMatchObject({ date: '2026-05-04', sleep: '好', energy: '高', time: '60' });
    expect(context.todayStatus.soreness).toEqual(['无']);
  });

  it('defaults missing RC state arrays to empty root and settings mirrors', () => {
    const sanitized = sanitizeData({
      ...makeAppData(),
      schemaVersion: 2,
      pendingSessionPatches: undefined,
      dismissedCoachActions: undefined,
      dismissedDataHealthIssues: undefined,
      settings: {},
    });

    expect(sanitized.pendingSessionPatches).toEqual([]);
    expect(sanitized.settings.pendingSessionPatches).toEqual([]);
    expect(sanitized.dismissedCoachActions).toEqual([]);
    expect(sanitized.settings.dismissedCoachActions).toEqual([]);
    expect(sanitized.dismissedDataHealthIssues).toEqual([]);
    expect(sanitized.settings.dismissedDataHealthIssues).toEqual([]);
    expect(sanitized.settings.dataRepairLogs).toEqual([]);
  });

  it('keeps actualWeightKg as the calculation source when legacy display fields disagree', () => {
    const sanitized = sanitizeData({
      ...makeAppData(),
      ...(unitFixture.data as Partial<AppData>),
      schemaVersion: 1,
    });
    const actualSourceSession = sanitized.history.find((session) => session.id === 'fixture-unit-actual-source');
    const set = actualSourceSession?.exercises[0]?.sets[0];

    expect(set).toMatchObject({ actualWeightKg: 52.6, displayWeight: 0, displayUnit: 'lb' });
    expect(sessionVolume(actualSourceSession)).toBe(526);
  });

  it('keeps legacy replacement ids out of active exercise identity during migration', () => {
    const sanitized = sanitizeData({
      ...makeAppData(),
      ...(assistedPullupFixture.data as Partial<AppData>),
      schemaVersion: 1,
    });
    const invalidExercise = sanitized.history.find((session) => session.id === 'fixture-assisted-legacy-invalid')?.exercises[0];
    const validExercise = sanitized.history.find((session) => session.id === 'fixture-assisted-valid')?.exercises[0];

    expect(validExercise?.actualExerciseId).toBe('assisted-pull-up');
    expect(validExercise?.identityInvalid).not.toBe(true);
    expect(invalidExercise).toMatchObject({
      identityInvalid: true,
      legacyActualExerciseId: 'legacy-assisted-pullup',
      legacyReplacementExerciseId: '__auto_alt_assisted_pullup',
    });
    expect(invalidExercise?.actualExerciseId).toBeUndefined();
    expect(invalidExercise?.replacementExerciseId).toBeUndefined();
    expect(getExerciseRecordPoolId(invalidExercise)).toBe('');
  });

  it('migrates older schemaVersion and accepts current schemaVersion data', () => {
    const migrated = sanitizeData({
      ...makeAppData({
        history: [],
        selectedTemplateId: 'pull-a',
        activeProgramTemplateId: 'pull-a',
      }),
      schemaVersion: 1,
    });
    const current = sanitizeData({
      ...migrated,
      schemaVersion: STORAGE_VERSION,
    });

    expect(migrated.schemaVersion).toBe(STORAGE_VERSION);
    expect(current.schemaVersion).toBe(STORAGE_VERSION);
    expect(current.selectedTemplateId).toBe('pull-a');
    expect(current.activeProgramTemplateId).toBe('pull-a');
    expect(validateAppDataSchema(current)).toBe(true);
  });
});
