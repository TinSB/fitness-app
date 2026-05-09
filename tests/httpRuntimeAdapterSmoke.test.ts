import { describe, expect, it } from 'vitest';
import { createServerAdapter, createSqliteRepository } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { createHttpTestServer, fetchJson, HTTP_NOW, wrapAdapterResponse } from './httpRuntimeAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

describe('HTTP runtime adapter smoke', () => {
  it('serves GET /health as JSON without requiring a snapshot', async () => {
    const repository = createSqliteRepository();
    const adapter = createServerAdapter({ repository, clock: () => HTTP_NOW });
    const server = await createHttpTestServer({ data: null, serverAdapter: adapter });
    try {
      const response = await fetchJson(`${server.url}/health`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.body).toMatchObject({
        result: {
          service: 'ironpath-server-adapter',
          runtimeServer: false,
          repository: { ok: true, status: 'ready' },
        },
      });
      expect(snapshotCount(repository.database)).toBe(0);
    } finally {
      await server.close();
    }
  });

  it('returns GET /app-data/summary parity with direct serverAdapter.handleRequest', async () => {
    const data = makeAppData({ selectedTemplateId: 'pull-a' });
    const server = await createHttpTestServer({ data });
    try {
      const response = await fetchJson(`${server.url}/app-data/summary`);
      const direct = server.adapter.handleRequest({ method: 'GET', path: '/app-data/summary', query: {} });

      expect(response.status).toBe(direct.status);
      expect(response.body).toEqual(wrapAdapterResponse(direct));
    } finally {
      await server.close();
    }
  });

  it('passes POST /sessions/start through serverAdapter and writes a snapshot on success', async () => {
    const server = await createHttpTestServer({ data: makeAppData({ selectedTemplateId: 'push-a' }) });
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const response = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.body).toMatchObject({
        result: { ok: true, changed: true, reasonCode: 'session_started' },
        snapshot: { createdAt: HTTP_NOW },
      });
      expect(snapshotCount(server.repository.database)).toBe(beforeCount + 1);
      expect(server.repository.readSnapshot().activeSession).toBeDefined();
    } finally {
      await server.close();
    }
  });
});
