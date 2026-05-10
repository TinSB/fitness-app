import { describe, expect, it } from 'vitest';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src/recordDataHealthMutation';
import {
  DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS,
  validateHistorySetEditPatch,
} from '../src/devApi/devApiHistorySetEditClient';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { makeRecordData } from './recordDataHealthMutationFixtures';

describe('Dev API limited history edit semantics', () => {
  it('locks allowed patch fields and rejected broad fields', () => {
    expect(DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS).toEqual([
      'weightKg',
      'displayWeight',
      'displayUnit',
      'reps',
      'rir',
      'techniqueQuality',
      'painFlag',
      'note',
    ]);

    for (const field of [
      'dataFlag',
      'id',
      'date',
      'templateId',
      'exerciseId',
      'setId',
      'done',
      'activeSession',
      'editHistory',
      'summary',
      'appData',
    ]) {
      expect(validateHistorySetEditPatch({ [field]: 'blocked' })).toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_invalid_patch' },
      });
    }
  });

  it('rejects invalid values before request', () => {
    for (const patch of [
      { weightKg: Number.NaN },
      { displayWeight: -1 },
      { reps: -1 },
      { rir: '-1' },
      { techniqueQuality: 'excellent' },
      { painFlag: 'false' },
    ]) {
      expect(validateHistorySetEditPatch(patch)).toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_invalid_patch' },
      });
    }
  });

  it('keeps actualWeightKg trusted and display fields display-only unless paired with weightKg', () => {
    const data = makeRecordData();
    const displayOnly = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { displayWeight: 230, displayUnit: 'lb' },
      },
    });
    expect(displayOnly.result).toMatchObject({ ok: true, changed: false, reasonCode: 'record_no_change' });
    expect(displayOnly.nextData).toBeUndefined();

    const withTrustedWeight = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, displayWeight: 231, displayUnit: 'lb' },
      },
    });
    expect(withTrustedWeight.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(withTrustedWeight.nextData!.history[0].exercises[0].sets[0]).toMatchObject({
      weight: 105,
      actualWeightKg: 105,
      displayWeight: 231,
      displayUnit: 'lb',
    });
  });

  it('does not route dataFlag or active session mutation through the edit route', () => {
    const data = makeRecordData();
    const dataFlag = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { dataFlag: 'excluded' },
      },
    });
    const activeSession = handleRecordDataHealthMutationRequest({ ...data, activeSession: data.history[0] }, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { activeSession: null },
      },
    });

    expect(dataFlag.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_edit_invalid' });
    expect(activeSession.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_edit_invalid' });
  });

  it('does not change training algorithm behavior, PR rules, or effective-set rules', () => {
    const data = makeRecordData();
    const beforeEffective = buildEffectiveVolumeSummary(data.history);
    const beforePr = buildPrs(data.history);
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { note: 'note only' },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(buildEffectiveVolumeSummary(response.nextData!.history)).toEqual(beforeEffective);
    expect(buildPrs(response.nextData!.history)).toEqual(beforePr);
  });
});
