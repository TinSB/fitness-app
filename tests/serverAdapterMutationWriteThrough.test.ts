import { describe, expect, it } from 'vitest';
import type { SessionPatch } from '../src/engines/sessionPatchEngine';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import {
  makeRecordData,
  makeRepairableWeightData,
} from './recordDataHealthMutationFixtures';
import { expectSnapshotWrite, seedAdapter } from './serverAdapterTestHelpers';
import { latestSnapshotLabel, snapshotCount } from './sqliteRepositoryTestHelpers';

const mainOnlyPatch: SessionPatch = {
  id: 'adapter-main-only',
  type: 'main_only',
  title: 'Only main work',
  description: 'Keep main work only.',
  reason: 'Adapter parity test.',
  reversible: true,
};

describe('server adapter mutation write-through', () => {
  it('writes a new latest snapshot for POST /sessions/start', () => {
    const { repository, adapter } = seedAdapter(makeAppData({ selectedTemplateId: 'push-a' }));
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({ method: 'POST', path: '/sessions/start' });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_started' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().activeSession).toBeDefined();
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/sessions/start');
    repository.close();
  });

  it('writes a new latest snapshot for POST /sessions/active/patches', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 3, 0)]);
    const { repository, adapter } = seedAdapter(makeAppData({ activeSession }));
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/sessions/active/patches',
      body: { patches: [mainOnlyPatch] },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_patches_applied' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/sessions/active/patches');
    repository.close();
  });

  it('writes a new latest snapshot for POST /sessions/active/complete', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 1, 1)]);
    const { repository, adapter } = seedAdapter(makeAppData({ activeSession }));
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({ method: 'POST', path: '/sessions/active/complete' });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_completed' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().activeSession).toBeNull();
    expect(repository.readSnapshot().history).toHaveLength(1);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/sessions/active/complete');
    repository.close();
  });

  it('writes a new latest snapshot for POST /sessions/active/discard', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 1, 0)]);
    const { repository, adapter } = seedAdapter(makeAppData({ activeSession }));
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/sessions/active/discard',
      body: { confirmDiscard: true },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_discarded' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().activeSession).toBeNull();
    expect(repository.readSnapshot().history).toHaveLength(0);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/sessions/active/discard');
    repository.close();
  });

  it('writes a new latest snapshot for POST /history/:id/edit', () => {
    const { repository, adapter } = seedAdapter(makeRecordData());
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, reps: 8 },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().history[0].editHistory?.length).toBeGreaterThan(0);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/history/:id/edit');
    repository.close();
  });

  it('writes a new latest snapshot for POST /history/:id/data-flag', () => {
    const { repository, adapter } = seedAdapter(makeRecordData());
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().history[0].dataFlag).toBe('excluded');
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/history/:id/data-flag');
    repository.close();
  });

  it('writes a new latest snapshot for POST /data-health/issues/:issueId/dismiss', () => {
    const data = makeRepairableWeightData();
    const issue = buildDataHealthReport(data).issues.find((item) => item.canAutoFix);
    expect(issue).toBeDefined();
    const { repository, adapter } = seedAdapter(data);
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: `/data-health/issues/${encodeURIComponent(issue!.id)}/dismiss`,
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_issue_dismissed' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(repository.readSnapshot().dismissedDataHealthIssues).toHaveLength(1);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/data-health/issues/:issueId/dismiss');
    repository.close();
  });

  it('writes a new latest snapshot for POST /data-health/repair/apply', () => {
    const { repository, adapter } = seedAdapter(makeRepairableWeightData());
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_repair_applied' });
    expectSnapshotWrite(repository, beforeCount, response);
    expect(latestSnapshotLabel(repository.database)).toBe('mutation:/data-health/repair/apply');
    repository.close();
  });
});
