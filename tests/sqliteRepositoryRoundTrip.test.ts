import { describe, expect, it } from 'vitest';
import { createSqliteRepository, SqliteRepositoryError } from '../apps/api/src/node';
import { emptyData, validateAppDataSchema } from '../src/storage/persistence';
import { makeAppData } from './fixtures';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { appMetaValue, canonicalAppData, expectAppDataParity, snapshotCount } from './sqliteRepositoryTestHelpers';

describe('SQLite repository AppData round-trip', () => {
  it('writes and reads emptyData without changing AppData semantics', () => {
    const repo = createSqliteRepository();
    const data = emptyData();
    const before = JSON.stringify(data);
    const snapshot = repo.writeSnapshot(data, {
      snapshotId: 'empty-snapshot',
      createdAt: '2026-05-08T10:00:00.000Z',
      label: 'empty',
    });
    const restored = repo.readSnapshot(snapshot.snapshotId);

    expect(snapshot).toEqual({
      snapshotId: 'empty-snapshot',
      schemaVersion: canonicalAppData(data).schemaVersion,
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    expect(JSON.stringify(data)).toBe(before);
    expect(validateAppDataSchema(restored)).toBe(true);
    expectAppDataParity(restored, data);
    repo.close();
  });

  it('round-trips a real migrated fixture and preserves validation parity', () => {
    const repo = createSqliteRepository();
    const data = buildAppDataFromFixture('legacy-unit-display');
    const before = JSON.stringify(data);

    repo.writeSnapshot(data, { snapshotId: 'legacy-unit', createdAt: '2026-05-08T10:00:00.000Z' });
    const restored = repo.readSnapshot();

    expect(JSON.stringify(data)).toBe(before);
    expect(validateAppDataSchema(restored)).toBe(true);
    expectAppDataParity(restored, data);
    repo.close();
  });

  it('uses row_id rather than createdAt for latest snapshot selection', () => {
    const repo = createSqliteRepository();
    const first = makeAppData({ selectedTemplateId: 'push-a' });
    const second = makeAppData({ selectedTemplateId: 'pull-a' });

    repo.writeSnapshot(first, { snapshotId: 'same-time-first', createdAt: '2026-05-08T10:00:00.000Z' });
    repo.writeSnapshot(second, { snapshotId: 'same-time-second', createdAt: '2026-05-08T10:00:00.000Z' });

    expect(repo.readSnapshot().selectedTemplateId).toBe('pull-a');
    repo.close();
  });

  it('rolls back metadata and snapshot rows when writeSnapshot fails', () => {
    const repo = createSqliteRepository();
    const first = makeAppData({ selectedTemplateId: 'push-a' });
    const second = makeAppData({ selectedTemplateId: 'pull-a' });

    repo.writeSnapshot(first, { snapshotId: 'duplicate-snapshot', createdAt: '2026-05-08T10:00:00.000Z' });
    expect(snapshotCount(repo.database)).toBe(1);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('duplicate-snapshot');

    expect(() =>
      repo.writeSnapshot(second, { snapshotId: 'duplicate-snapshot', createdAt: '2026-05-08T10:00:01.000Z' }),
    ).toThrow();

    expect(snapshotCount(repo.database)).toBe(1);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('duplicate-snapshot');
    expect(repo.readSnapshot().selectedTemplateId).toBe('push-a');
    repo.close();
  });

  it('throws a stable repository error for invalid snapshot JSON instead of returning defaults', () => {
    const repo = createSqliteRepository();
    repo.database.prepare(
      'INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)',
    ).run('invalid-json', 1, '{not json', '2026-05-08T10:00:00.000Z', null);

    expect(() => repo.readSnapshot('invalid-json')).toThrow(SqliteRepositoryError);
    expect(() => repo.readSnapshot('invalid-json')).toThrow('SQLite snapshot JSON is invalid.');
    repo.close();
  });
});
