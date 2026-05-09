import { describe, expect, it } from 'vitest';
import {
  assertNodeSqliteAvailable,
  createSqliteRepository,
  SQLITE_REPOSITORY_SCHEMA_VERSION,
  SqliteRepositoryError,
  type SqliteRepositoryErrorCode,
} from '../apps/api/src/node';
import type { AppData } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { appMetaValue, snapshotCount, snapshotExists } from './sqliteRepositoryTestHelpers';

const expectRepositoryError = (operation: () => unknown, code: SqliteRepositoryErrorCode) => {
  try {
    operation();
    throw new Error('Expected SqliteRepositoryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(SqliteRepositoryError);
    expect((error as SqliteRepositoryError).code).toBe(code);
    expect((error as Error).message).not.toContain('undefined');
    expect((error as Error).message).not.toContain('null');
  }
};

describe('SQLite repository failure modes', () => {
  it('returns snapshot_not_found for missing explicit and latest snapshots', () => {
    const repo = createSqliteRepository();

    expectRepositoryError(() => repo.readSnapshot(), 'snapshot_not_found');
    expectRepositoryError(() => repo.readSnapshot('missing-snapshot'), 'snapshot_not_found');
    repo.close();
  });

  it('returns snapshot_json_invalid for corrupt snapshot JSON', () => {
    const repo = createSqliteRepository();
    repo.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt-json', 1, '{not-json', '2026-05-08T10:00:00.000Z', null);

    expectRepositoryError(() => repo.readSnapshot('corrupt-json'), 'snapshot_json_invalid');
    repo.close();
  });

  it('returns snapshot_validation_failed for JSON that is not valid AppData', () => {
    const repo = createSqliteRepository();
    repo.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('invalid-app-data', 1, JSON.stringify({ schemaVersion: 1, history: [] }), '2026-05-08T10:00:00.000Z', null);

    expectRepositoryError(() => repo.readSnapshot('invalid-app-data'), 'snapshot_validation_failed');
    repo.close();
  });

  it('fails duplicate snapshot ids without changing latest_snapshot_id', () => {
    const repo = createSqliteRepository();
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'duplicate-id',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expectRepositoryError(
      () =>
        repo.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
          snapshotId: 'duplicate-id',
          createdAt: '2026-05-08T10:01:00.000Z',
        }),
      'write_failed',
    );

    expect(snapshotCount(repo.database)).toBe(1);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('duplicate-id');
    expect(repo.readSnapshot().selectedTemplateId).toBe('push-a');
    repo.close();
  });

  it('fails write validation without leaving a snapshot or latest metadata', () => {
    const repo = createSqliteRepository();
    const invalidData = { ...makeAppData(), templates: 'broken' } as unknown as AppData;

    expectRepositoryError(
      () =>
        repo.writeSnapshot(invalidData, {
          snapshotId: 'invalid-write',
          createdAt: '2026-05-08T10:00:00.000Z',
        }),
      'snapshot_validation_failed',
    );

    expect(snapshotCount(repo.database)).toBe(0);
    expect(snapshotExists(repo.database, 'invalid-write')).toBe(false);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBeUndefined();
    repo.close();
  });

  it('returns repository_schema_mismatch for unsupported repository schema metadata', () => {
    const DatabaseSync = assertNodeSqliteAvailable();
    const database = new DatabaseSync(':memory:');
    database.exec(`
      CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO app_meta(key, value) VALUES ('repository_schema_version', '999');
    `);

    expectRepositoryError(() => createSqliteRepository({ database }), 'repository_schema_mismatch');
    database.close();
  });

  it('writes the expected repository schema version for new repositories', () => {
    const repo = createSqliteRepository();

    expect(appMetaValue(repo.database, 'repository_schema_version')).toBe(String(SQLITE_REPOSITORY_SCHEMA_VERSION));
    repo.close();
  });
});
