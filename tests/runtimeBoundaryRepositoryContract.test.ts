import { describe, expect, it } from 'vitest';
import {
  createSqliteRepository,
  SqliteRepositoryError,
  type SqliteRepositoryErrorCode,
} from '../apps/api/src/node';
import type { AppData } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { appMetaValue, latestSnapshotLabel, snapshotCount, snapshotExists } from './sqliteRepositoryTestHelpers';
import { expectSourceNotToContain, repoRoot } from './runtimeBoundaryTestHelpers';
import { resolve } from 'node:path';

const expectRepositoryError = (operation: () => unknown, code: SqliteRepositoryErrorCode) => {
  try {
    operation();
    throw new Error('Expected SqliteRepositoryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(SqliteRepositoryError);
    expect((error as SqliteRepositoryError).code).toBe(code);
    expect(JSON.stringify(error)).not.toContain('stack');
  }
};

describe('runtime boundary repository contract acceptance', () => {
  it('keeps SQLite schema snapshot-only without normalized training tables', () => {
    const repo = createSqliteRepository();
    const tables = repo.database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(['app_data_snapshots', 'app_meta', 'sqlite_sequence']);
    ['sessions', 'sets', 'exercises', 'analytics', 'data_health_issues'].forEach((table) => {
      expect(tables).not.toContain(table);
    });
    repo.close();
  });

  it('selects latest snapshots by row_id rather than createdAt, label, or latest_snapshot_id metadata', () => {
    const repo = createSqliteRepository();
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'first',
      createdAt: '2026-05-09T10:00:00.000Z',
      label: 'not-latest',
    });
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
      snapshotId: 'second',
      createdAt: '2026-05-09T10:00:00.000Z',
      label: 'latest-by-row-id',
    });
    repo.database
      .prepare('INSERT OR REPLACE INTO app_meta(key, value) VALUES (?, ?)')
      .run('latest_snapshot_id', 'first');

    expect(repo.readSnapshot().selectedTemplateId).toBe('pull-a');
    expect(latestSnapshotLabel(repo.database)).toBe('latest-by-row-id');
    repo.close();
  });

  it('fails corrupt and invalid snapshots explicitly instead of falling back to emptyData', () => {
    const repo = createSqliteRepository();
    repo.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt', 1, '{bad', '2026-05-09T10:00:00.000Z', null);
    repo.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('invalid', 1, JSON.stringify({ schemaVersion: 1, history: [] }), '2026-05-09T10:01:00.000Z', null);

    expectRepositoryError(() => repo.readSnapshot('corrupt'), 'snapshot_json_invalid');
    expectRepositoryError(() => repo.readSnapshot('invalid'), 'snapshot_validation_failed');
    repo.close();
  });

  it('rolls back failed writes without partial snapshots or corrupt latest metadata', () => {
    const repo = createSqliteRepository();
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'stable',
      createdAt: '2026-05-09T10:00:00.000Z',
    });
    repo.database.exec(`
      CREATE TRIGGER runtime_boundary_write_fail
      BEFORE INSERT ON app_data_snapshots
      WHEN NEW.id = 'failed'
      BEGIN
        SELECT RAISE(ABORT, 'forced runtime boundary failure');
      END;
    `);

    expectRepositoryError(
      () =>
        repo.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
          snapshotId: 'failed',
          createdAt: '2026-05-09T10:01:00.000Z',
        }),
      'transaction_failed',
    );

    expect(snapshotCount(repo.database)).toBe(1);
    expect(snapshotExists(repo.database, 'failed')).toBe(false);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('stable');
    expect(repo.readSnapshot().selectedTemplateId).toBe('push-a');
    repo.close();
  });

  it('returns stable database_closed after close and remains Node-only isolated', () => {
    const repo = createSqliteRepository();
    repo.close();
    repo.close();

    expectRepositoryError(() => repo.readSnapshot(), 'database_closed');
    expectRepositoryError(() => repo.writeSnapshot(makeAppData() as AppData), 'database_closed');
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), ['sqliteRepository', 'node:sqlite']);
  });
});
