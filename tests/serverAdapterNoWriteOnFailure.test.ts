import { describe, expect, it } from 'vitest';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { makeRecordData, makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { expectNoSnapshotWrite, seedAdapter } from './serverAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

const expectNoWriteFor = (
  data: ReturnType<typeof makeAppData>,
  request: { method: string; path: string; body?: unknown },
) => {
  const { repository, adapter } = seedAdapter(data);
  const beforeCount = snapshotCount(repository.database);
  const response = adapter.handleRequest(request);
  expectNoSnapshotWrite(repository, beforeCount, response);
  repository.close();
  return response;
};

describe('server adapter no-write failure behavior', () => {
  it('does not write snapshots for session conflict, no-op, invalid, or requires-confirmation results', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);

    expectNoWriteFor(makeAppData({ activeSession }), { method: 'POST', path: '/sessions/start' });
    expectNoWriteFor(makeAppData(), { method: 'POST', path: '/sessions/active/patches', body: { patches: [] } });
    expectNoWriteFor(makeAppData(), { method: 'POST', path: '/sessions/active/complete' });
    expectNoWriteFor(makeAppData({ activeSession }), { method: 'POST', path: '/sessions/active/complete' });
    expectNoWriteFor(makeAppData({ activeSession }), { method: 'POST', path: '/sessions/active/discard' });
  });

  it('does not write snapshots for record and DataHealth failures', () => {
    const editNotFound = expectNoWriteFor(makeRecordData(), {
      method: 'POST',
      path: '/history/missing/edit',
      body: { exerciseId: 'bench-press', setId: 'bench-press-1', patch: { weightKg: 105 } },
    });
    const invalidEdit = expectNoWriteFor(makeRecordData(), {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: { patch: { weightKg: 105 } },
    });
    const noChangeDataFlag = expectNoWriteFor(makeRecordData(), {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'normal' },
    });
    const issueNotFound = expectNoWriteFor(makeRecordData(), {
      method: 'POST',
      path: '/data-health/issues/missing/dismiss',
    });
    const unsupportedRepair = expectNoWriteFor(makeRepairableWeightData(), {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'unsupported', confirmRepair: true },
    });
    const unsafeImportLike = expectNoWriteFor(makeRepairableWeightData(), {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'legacy_display_weight', confirmRepair: true, rawData: { source: 'health-json', samples: [] } },
    });

    expect(editNotFound.result).toMatchObject({ reasonCode: 'record_not_found' });
    expect(invalidEdit.result).toMatchObject({ reasonCode: 'record_edit_invalid' });
    expect(noChangeDataFlag.result).toMatchObject({ reasonCode: 'record_no_change' });
    expect(issueNotFound.result).toMatchObject({ reasonCode: 'data_health_issue_not_found' });
    expect(unsupportedRepair.result).toMatchObject({ reasonCode: 'data_health_repair_not_supported' });
    expect(unsafeImportLike.result).toMatchObject({ reasonCode: 'unsafe_import_rejected' });
  });

  it('does not write snapshots for unsupported routes or wrong methods', () => {
    const unknown = expectNoWriteFor(makeAppData(), { method: 'GET', path: '/unknown-route' });
    const wrongMethod = expectNoWriteFor(makeAppData(), { method: 'DELETE', path: '/sessions/start' });

    expect(unknown).toMatchObject({ status: 404, result: { reasonCode: 'unsupported_route' } });
    expect(wrongMethod).toMatchObject({ status: 405, result: { reasonCode: 'unsupported_route' } });
  });
});
