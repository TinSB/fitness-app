import { describe, expect, it } from 'vitest';
import {
  buildReadMirrorAppDataSummary,
  buildReadMirrorDataHealthSummary,
  buildReadMirrorHistoryDetail,
  buildReadMirrorHistoryList,
  buildReadMirrorSessionsSummary,
} from '../apps/api/src';
import { createSqliteRepository } from '../apps/api/src/node';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

describe('SQLite repository readMirror parity', () => {
  it('keeps readMirror outputs identical after SQLite round-trip', () => {
    const repo = createSqliteRepository();
    const data = buildAppDataFromFixture('legacy-unit-display');
    const targetSessionId = data.history[0]?.id;
    expect(targetSessionId).toBeTruthy();

    repo.writeSnapshot(data, {
      snapshotId: 'read-mirror-parity',
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    const restored = repo.readSnapshot();

    expect(buildReadMirrorAppDataSummary(restored)).toEqual(buildReadMirrorAppDataSummary(data));
    expect(buildReadMirrorSessionsSummary(restored)).toEqual(buildReadMirrorSessionsSummary(data));
    expect(buildReadMirrorHistoryList(restored)).toEqual(buildReadMirrorHistoryList(data));
    expect(buildReadMirrorHistoryDetail(restored, targetSessionId!)).toEqual(buildReadMirrorHistoryDetail(data, targetSessionId!));
    expect(buildReadMirrorDataHealthSummary(restored)).toEqual(buildReadMirrorDataHealthSummary(data));
    repo.close();
  });
});
