import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { appMetaValue } from './sqliteRepositoryTestHelpers';

describe('SQLite repository latest snapshot ordering', () => {
  it('selects latest by row_id, not createdAt, label, or latest_snapshot_id metadata', () => {
    const repo = createSqliteRepository();
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'latest-first',
      createdAt: '2026-05-08T10:00:00.000Z',
      label: 'zzz',
    });
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
      snapshotId: 'latest-second',
      createdAt: '2026-05-08T10:00:00.000Z',
      label: 'aaa',
    });
    repo.database
      .prepare('INSERT OR REPLACE INTO app_meta(key, value) VALUES (?, ?)')
      .run('latest_snapshot_id', 'latest-first');

    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('latest-first');
    expect(repo.readSnapshot().selectedTemplateId).toBe('pull-a');
    repo.close();
  });
});
