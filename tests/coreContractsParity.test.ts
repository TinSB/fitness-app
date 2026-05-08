import { describe, expect, it } from 'vitest';
import {
  APP_DATA_SCHEMA_VERSION,
  appDataJsonSchema,
  type AppData as ContractAppData,
  type DataHealthIssue as ContractDataHealthIssue,
  type FocusActionResult as ContractFocusActionResult,
  type PendingSessionPatch as ContractPendingSessionPatch,
  type ProgramAdjustmentDraft as ContractProgramAdjustmentDraft,
  type ProgramTemplate as ContractProgramTemplate,
  type SessionEditHistoryEntry as ContractSessionEditHistoryEntry,
  type TrainingExercise as ContractTrainingExercise,
  type TrainingSession as ContractTrainingSession,
  type TrainingSet as ContractTrainingSet,
} from '../packages/contracts/src';
import { STORAGE_VERSION } from '../src/data/appConfig';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import type {
  AppData as SrcAppData,
  ExercisePrescription,
  PendingSessionPatch as SrcPendingSessionPatch,
  ProgramAdjustmentDraft as SrcProgramAdjustmentDraft,
  ProgramTemplate as SrcProgramTemplate,
  SessionEditHistoryItem,
  TrainingSession as SrcTrainingSession,
  TrainingSetLog,
} from '../src/models/training-model';
import { validateAppDataSchema } from '../src/storage/persistence';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const assertAssignable = <T>(_value: T) => undefined;

describe('core/contracts parity baseline', () => {
  it('exposes AppData-compatible contracts without duplicating model definitions', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const contractData: ContractAppData = data;

    assertAssignable<SrcAppData>(contractData);
    expect(contractData.history.length).toBeGreaterThan(0);
    expect(validateAppDataSchema(contractData)).toBe(true);
  });

  it('keeps contract aliases assignable to existing source model types', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const contractSession: ContractTrainingSession = data.history[0];
    const contractExercise: ContractTrainingExercise = contractSession.exercises[0];
    const contractSet: ContractTrainingSet = contractExercise.sets[0];
    const editEntry: ContractSessionEditHistoryEntry = {
      editedAt: '2026-05-08T10:00:00.000Z',
      fields: ['weight'],
      changedFields: ['weight'],
      beforeSummaryText: '正式组 1：100kg × 8 / RIR 2',
      afterSummaryText: '正式组 1：102.5kg × 8 / RIR 2',
      affectedStats: ['volume', 'effectiveSet', 'PR', 'e1RM'],
    };
    const maybeDraft = buildAppDataFromFixture('duplicate-plan-draft').programAdjustmentDrafts?.[0] as
      | ContractProgramAdjustmentDraft
      | undefined;
    const maybePatch = data.pendingSessionPatches?.[0] as ContractPendingSessionPatch | undefined;

    assertAssignable<SrcTrainingSession>(contractSession);
    assertAssignable<ExercisePrescription>(contractExercise);
    assertAssignable<TrainingSetLog>(contractSet);
    assertAssignable<SessionEditHistoryItem>(editEntry);
    assertAssignable<SrcProgramTemplate>(data.programTemplate as ContractProgramTemplate);
    assertAssignable<SrcProgramAdjustmentDraft | undefined>(maybeDraft);
    assertAssignable<SrcPendingSessionPatch | undefined>(maybePatch);

    expect(contractExercise.id).toBeTruthy();
    expect(contractSet.id).toBeTruthy();
    expect(editEntry.affectedStats).toEqual(['volume', 'effectiveSet', 'PR', 'e1RM']);
  });

  it('exposes DataHealth and Focus action result contracts from the current source of truth', () => {
    const report = buildDataHealthReport(buildAppDataFromFixture('incomplete-draft-sets-session'));
    const issue: ContractDataHealthIssue | undefined = report.issues[0];
    const result: ContractFocusActionResult = {
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前已是建议值。',
      reasonCode: 'no_change',
    };

    expect(issue?.id || '').not.toMatch(/undefined|null/);
    expect(result).toMatchObject({
      ok: true,
      changed: false,
      message: '当前已是建议值。',
    });
  });

  it('exposes the existing AppData schema reference without changing schema version', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');

    expect(APP_DATA_SCHEMA_VERSION).toBe(STORAGE_VERSION);
    expect(appDataJsonSchema).toMatchObject({ type: 'object' });
    expect(validateAppDataSchema(data)).toBe(true);
  });
});
