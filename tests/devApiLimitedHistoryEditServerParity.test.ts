import { describe, expect, it } from 'vitest';
import { buildReadMirrorHistoryDetail } from '../apps/api/src';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src/recordDataHealthMutation';
import {
  expectNoNextData,
  expectNextDataRule,
  makeRecordData,
  NOW,
} from './recordDataHealthMutationFixtures';

describe('Dev API limited history edit server parity', () => {
  it('returns nextData only for changed set edits and preserves readMirror parity', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      nowIso: NOW,
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, reps: 8, note: 'reviewed' },
        reason: 'dev check',
      },
    });

    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'record_updated',
    });
    expectNextDataRule(response);
    expect(response.nextData!.history[0].exercises[0].sets[0]).toMatchObject({
      weight: 105,
      actualWeightKg: 105,
      reps: 8,
      note: 'reviewed',
    });
    expect(response.nextData!.history[0].editHistory?.at(-1)?.changedFields).toEqual(['weight', 'note']);
    expect(response.nextData!.history[0].editHistory?.at(-1)?.affectedStats).toContain('PR');
    expect(buildReadMirrorHistoryDetail(response.nextData!, 'record-mutation-session')?.session.exercises[0].sets[0].actualWeightKg).toBe(105);
  });

  it('does not expose nextData for no-op, not-found, invalid body, or missing nextData cases', () => {
    const data = makeRecordData();
    const noChange = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 100, reps: 8 },
      },
    });
    const notFound = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/missing/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105 },
      },
    });
    const invalid = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { displayUnit: 'stone' },
      },
    });

    expect(noChange.result).toMatchObject({ ok: true, changed: false, reasonCode: 'record_no_change' });
    expect(notFound.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_not_found' });
    expect(invalid.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_edit_invalid' });
    expectNoNextData(noChange);
    expectNoNextData(notFound);
    expectNoNextData(invalid);
  });

  it('keeps editHistory and audit trail semantics owned by server/core', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      nowIso: NOW,
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { note: 'server owned audit' },
        editHistory: [{ id: 'client-audit' }],
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    const audit = response.nextData!.history[0].editHistory?.at(-1);
    expect(audit?.id).not.toBe('client-audit');
    expect(audit?.note).toBe('历史训练详情修正');
    expect(data.history[0].editHistory).toBeUndefined();
  });

  it('keeps backup/import semantics unchanged by the edit route', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { note: 'checked' },
        backup: { history: [] },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(response.nextData!.history).toHaveLength(1);
    expect(response.nextData!.history[0].id).toBe('record-mutation-session');
  });
});
