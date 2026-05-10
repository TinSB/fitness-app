import { describe, expect, it } from 'vitest';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src/recordDataHealthMutation';
import { validateHistorySetEditPatch } from '../src/devApi/devApiHistorySetEditClient';
import { makeRecordData } from './recordDataHealthMutationFixtures';

describe('limited history edit hardening semantics', () => {
  it('rejects broad client patch fields before request', () => {
    for (const patch of [
      { dataFlag: 'excluded' },
      { activeSession: null },
      { editHistory: [] },
      { summary: {} },
      { appData: {} },
      { setIndex: 2 },
    ]) {
      expect(validateHistorySetEditPatch(patch)).toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_invalid_patch' },
      });
    }
  });

  it('keeps display-only patches from becoming trusted calculation writes', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { displayWeight: 230, displayUnit: 'lb' },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: false, reasonCode: 'record_no_change' });
    expect(response.nextData).toBeUndefined();
  });

  it('keeps weightKg as trusted actualWeightKg when paired with display fields', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, displayWeight: 231, displayUnit: 'lb' },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(response.nextData!.history[0].exercises[0].sets[0]).toMatchObject({
      weight: 105,
      actualWeightKg: 105,
      displayWeight: 231,
      displayUnit: 'lb',
    });
  });
});
