import { describe, expect, it } from 'vitest';
import { createHttpTestServer, fetchJson } from './httpRuntimeAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';
import { makeRecordData } from './recordDataHealthMutationFixtures';

const expectHttpError = (body: unknown, code: string) => {
  expect(body).toMatchObject({ error: { code } });
  expect(JSON.stringify(body)).not.toContain('stack');
  expect(JSON.stringify(body)).not.toContain('SqliteRepositoryError');
};

describe('HTTP runtime adapter repository error mapping', () => {
  it('maps empty repository reads to snapshot_not_found', async () => {
    const server = await createHttpTestServer({ data: null });
    try {
      const response = await fetchJson(`${server.url}/app-data/summary`);
      expect(response.status).toBe(404);
      expectHttpError(response.body, 'snapshot_not_found');
    } finally {
      await server.close();
    }
  });

  it('maps closed repositories to database_closed', async () => {
    const server = await createHttpTestServer({ data: makeRecordData() });
    server.repository.close();
    try {
      const response = await fetchJson(`${server.url}/app-data/summary`);
      expect(response.status).toBe(503);
      expectHttpError(response.body, 'database_closed');
    } finally {
      await server.close();
    }
  });

  it('maps corrupt snapshots to snapshot_json_invalid', async () => {
    const server = await createHttpTestServer({ data: null });
    server.repository.database
      .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt', 1, '{not-json', '2026-05-09T10:00:00.000Z', null);
    try {
      const response = await fetchJson(`${server.url}/app-data/summary`);
      expect(response.status).toBe(500);
      expectHttpError(response.body, 'snapshot_json_invalid');
    } finally {
      await server.close();
    }
  });

  it('maps writeSnapshot failure after mutation nextData to a stable repository error', async () => {
    const server = await createHttpTestServer({ data: makeRecordData() });
    server.repository.database.exec(`
      CREATE TRIGGER fail_http_data_flag_write
      BEFORE INSERT ON app_data_snapshots
      WHEN NEW.label = 'mutation:/history/:id/data-flag'
      BEGIN
        SELECT RAISE(ABORT, 'forced http write failure');
      END;
    `);
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const response = await fetchJson(`${server.url}/history/record-mutation-session/data-flag`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"dataFlag":"excluded"}',
      });

      expect(response.status).toBe(500);
      expectHttpError(response.body, 'transaction_failed');
      expect(snapshotCount(server.repository.database)).toBe(beforeCount);
      expect(server.repository.readSnapshot().history[0].dataFlag).toBe('normal');
    } finally {
      await server.close();
    }
  });
});
