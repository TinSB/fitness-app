import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import {
  handleRecordDataHealthMutationRequest,
  handleSessionMutationRequest,
} from '../apps/api/src';
import { getTemplate, makeAppData } from './fixtures';
import {
  makeRecordData,
  makeRepairableWeightData,
} from './recordDataHealthMutationFixtures';

const expectNextDataRule = (response: { result: { ok: boolean; changed: boolean }; nextData?: unknown }) => {
  if (response.result.ok === true && response.result.changed === true) {
    expect(response.nextData).toBeDefined();
  } else {
    expect(response.nextData).toBeUndefined();
  }
};

const roundTrip = <TData extends ReturnType<typeof makeAppData>>(data: TData) => {
  const repo = createSqliteRepository();
  repo.writeSnapshot(data, {
    snapshotId: 'mutation-boundary',
    createdAt: '2026-05-08T10:00:00.000Z',
  });
  const restored = repo.readSnapshot();
  repo.close();
  return restored;
};

describe('SQLite repository mutation boundary parity', () => {
  it('returns AppData that sessionMutation can process without changing nextData rules', () => {
    const data = roundTrip(makeAppData({ templates: [getTemplate('push-a')], selectedTemplateId: 'push-a' }));
    const response = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/start',
      nowIso: '2026-05-08T10:00:00.000Z',
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_started' });
    expectNextDataRule(response);

    const conflict = handleSessionMutationRequest(response.nextData!, {
      method: 'POST',
      path: '/sessions/start',
      nowIso: '2026-05-08T10:01:00.000Z',
    });
    expect(conflict.result.reasonCode).toBe('active_session_exists');
    expectNextDataRule(conflict);
  });

  it('returns AppData that recordDataHealthMutation can process without changing nextData rules', () => {
    const data = roundTrip(makeRecordData());
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: '2026-05-08T10:00:00.000Z',
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expectNextDataRule(response);

    const noChange = handleRecordDataHealthMutationRequest(response.nextData!, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: '2026-05-08T10:01:00.000Z',
      body: { dataFlag: 'excluded' },
    });
    expect(noChange.result.reasonCode).toBe('record_no_change');
    expectNextDataRule(noChange);
  });

  it('does not make read or mutation boundaries statically depend on SQLite repository', () => {
    const root = process.cwd();
    const files = [
      'apps/api/src/readMirror.ts',
      'apps/api/src/sessionMutation.ts',
      'apps/api/src/recordDataHealthMutation.ts',
      'apps/api/src/index.ts',
    ];

    files.forEach((file) => {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toContain('sqliteRepository');
      expect(source).not.toContain('node:sqlite');
    });

    const repairData = roundTrip(makeRepairableWeightData());
    const repair = handleRecordDataHealthMutationRequest(repairData, {
      method: 'POST',
      path: '/data-health/repair/apply',
      nowIso: '2026-05-08T10:00:00.000Z',
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });
    expectNextDataRule(repair);
  });
});
