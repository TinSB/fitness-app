import { describe, expect, it } from 'vitest';
import { SERVER_ADAPTER_READ_ROUTES } from '../apps/api/src/node';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { createHttpTestServer, fetchJson, wrapAdapterResponse } from './httpRuntimeAdapterTestHelpers';

describe('HTTP runtime adapter route parity', () => {
  it('matches direct serverAdapter responses for all read routes', async () => {
    const server = await createHttpTestServer({ data: makeRecordData() });
    try {
      for (const route of SERVER_ADAPTER_READ_ROUTES) {
        const path = route.path === '/history/:id' ? '/history/record-mutation-session' : route.path;
        const http = await fetchJson(`${server.url}${path}`);
        const direct = server.adapter.handleRequest({ method: 'GET', path, query: {} });

        expect(http.status).toBe(direct.status);
        expect(http.body).toEqual(wrapAdapterResponse(direct));
      }
    } finally {
      await server.close();
    }
  });

  it('matches direct serverAdapter responses for a representative mutation route', async () => {
    const httpServer = await createHttpTestServer({ data: makeRecordData() });
    const directServer = await createHttpTestServer({ data: makeRecordData() });
    try {
      const requestBody = { dataFlag: 'excluded' };
      const http = await fetchJson(`${httpServer.url}/history/record-mutation-session/data-flag`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const direct = directServer.adapter.handleRequest({
        method: 'POST',
        path: '/history/record-mutation-session/data-flag',
        body: requestBody,
      });

      expect(http.status).toBe(direct.status);
      const expected = wrapAdapterResponse(direct) as { result: unknown; snapshot?: { createdAt: string; schemaVersion: number } };
      const actual = http.body as { result: unknown; snapshot?: { createdAt: string; schemaVersion: number } };
      expect(JSON.parse(JSON.stringify(actual.result))).toEqual(JSON.parse(JSON.stringify(expected.result)));
      expect(actual.snapshot).toMatchObject({
        createdAt: expected.snapshot?.createdAt,
        schemaVersion: expected.snapshot?.schemaVersion,
      });
    } finally {
      await httpServer.close();
      await directServer.close();
    }
  });

  it('preserves unsupported route and wrong method status/result shape', async () => {
    const server = await createHttpTestServer({ data: makeRecordData() });
    try {
      const unknown = await fetchJson(`${server.url}/missing-route`);
      const wrongMethod = await fetchJson(`${server.url}/history`, { method: 'POST' });

      expect(unknown).toMatchObject({ status: 404, body: { result: { reasonCode: 'unsupported_route' } } });
      expect(wrongMethod).toMatchObject({ status: 405, body: { result: { reasonCode: 'unsupported_route' } } });
    } finally {
      await server.close();
    }
  });
});
