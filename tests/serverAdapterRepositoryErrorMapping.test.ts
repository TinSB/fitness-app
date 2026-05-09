import { describe, expect, it } from 'vitest';
import {
  createServerAdapter,
  createSqliteRepository,
  SqliteRepositoryError,
  type ServerAdapterResponse,
} from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { seedAdapter } from './serverAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

const expectError = (response: ServerAdapterResponse, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(response.error).toMatchObject({ code });
  expect(response.result).toBeUndefined();
  expect(response.snapshot).toBeUndefined();
  expect(JSON.stringify(response.error)).not.toContain('stack');
};

describe('server adapter repository error mapping', () => {
  it('returns health on an empty repository without requiring an AppData snapshot', () => {
    const repository = createSqliteRepository();
    const adapter = createServerAdapter({ repository });
    const response = adapter.handleRequest({ method: 'GET', path: '/health' });

    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({
      ok: true,
      service: 'ironpath-server-adapter',
      runtimeServer: false,
      repository: { ok: true, status: 'ready' },
    });
    expect(snapshotCount(repository.database)).toBe(0);
    repository.close();
  });

  it('maps non-health reads on an empty repository to snapshot_not_found', () => {
    const repository = createSqliteRepository();
    const adapter = createServerAdapter({ repository });

    expectError(adapter.handleRequest({ method: 'GET', path: '/app-data/summary' }), 404, 'snapshot_not_found');
    repository.close();
  });

  it('maps closed repository health and read paths without exposing raw stacks', () => {
    const repository = createSqliteRepository();
    const adapter = createServerAdapter({ repository });
    repository.close();

    const health = adapter.handleRequest({ method: 'GET', path: '/health' });
    expect(health.status).toBe(200);
    expect(health.result).toMatchObject({
      repository: {
        ok: false,
        status: 'degraded',
        error: { code: 'database_closed' },
      },
    });
    expect(JSON.stringify(health.result)).not.toContain('stack');
    expectError(adapter.handleRequest({ method: 'GET', path: '/app-data/summary' }), 503, 'database_closed');
  });

  it('maps corrupt and schema-invalid snapshots to stable repository errors', () => {
    const corrupt = createSqliteRepository();
    corrupt.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt', 1, '{not-json', '2026-05-09T10:00:00.000Z', null);
    expectError(
      createServerAdapter({ repository: corrupt }).handleRequest({ method: 'GET', path: '/app-data/summary' }),
      500,
      'snapshot_json_invalid',
    );
    corrupt.close();

    const invalid = createSqliteRepository();
    invalid.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('invalid', 1, JSON.stringify({ schemaVersion: 1, history: [] }), '2026-05-09T10:00:00.000Z', null);
    expectError(
      createServerAdapter({ repository: invalid }).handleRequest({ method: 'GET', path: '/app-data/summary' }),
      500,
      'snapshot_validation_failed',
    );
    invalid.close();
  });

  it('maps repository_schema_mismatch from repository probes', () => {
    const repository = {
      database: {
        prepare: () => {
          throw new SqliteRepositoryError('repository_schema_mismatch', 'Schema mismatch.');
        },
      },
      readSnapshot: () => {
        throw new SqliteRepositoryError('repository_schema_mismatch', 'Schema mismatch.');
      },
      writeSnapshot: () => {
        throw new SqliteRepositoryError('repository_schema_mismatch', 'Schema mismatch.');
      },
      exportBackupFromSnapshot: () => '',
      importBackupToSnapshot: () => ({ ok: false, status: 'invalid', message: 'invalid' }),
      close: () => undefined,
    } as unknown as ReturnType<typeof createSqliteRepository>;
    const adapter = createServerAdapter({ repository });

    expect(adapter.handleRequest({ method: 'GET', path: '/health' }).result).toMatchObject({
      repository: { ok: false, status: 'degraded', error: { code: 'repository_schema_mismatch' } },
    });
    expectError(adapter.handleRequest({ method: 'GET', path: '/app-data/summary' }), 500, 'repository_schema_mismatch');
  });

  it('does not return mutation success if writeSnapshot fails after nextData is produced', () => {
    const { repository, adapter } = seedAdapter(makeRecordData());
    repository.database.exec(`
      CREATE TRIGGER fail_adapter_data_flag_write
      BEFORE INSERT ON app_data_snapshots
      WHEN NEW.label = 'mutation:/history/:id/data-flag'
      BEGIN
        SELECT RAISE(ABORT, 'forced adapter write failure');
      END;
    `);
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'excluded' },
    });

    expectError(response, 500, 'transaction_failed');
    expect(snapshotCount(repository.database)).toBe(beforeCount);
    expect(repository.readSnapshot().history[0].dataFlag).toBe('normal');
    repository.close();
  });

  it('maps an explicit write_failed repository error', () => {
    const data = makeAppData({ selectedTemplateId: 'push-a' });
    const repository = {
      database: createSqliteRepository().database,
      readSnapshot: () => data,
      writeSnapshot: () => {
        throw new SqliteRepositoryError('write_failed', 'Write failed.');
      },
      exportBackupFromSnapshot: () => '',
      importBackupToSnapshot: () => ({ ok: false, status: 'invalid', message: 'invalid' }),
      close: () => undefined,
    } as unknown as ReturnType<typeof createSqliteRepository>;
    const response = createServerAdapter({ repository }).handleRequest({ method: 'POST', path: '/sessions/start' });

    expectError(response, 500, 'write_failed');
    repository.database.close?.();
  });
});
