import { createServer, request as httpRequest } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createHttpRequestListener } from '../apps/api/src/node';
import { closeServer, createHttpTestServer, fetchJson } from './httpRuntimeAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

const fakeAdapter = () => {
  const requests: unknown[] = [];
  return {
    requests,
    handleRequest: (request: unknown) => {
      requests.push(request);
      return { status: 200, result: { request } };
    },
  };
};

const listenWithAdapter = async (adapter: ReturnType<typeof fakeAdapter>) => {
  const listener = createHttpRequestListener({ serverAdapter: adapter as never });
  const nodeServer = createServer(listener);
  await new Promise<void>((resolve) => nodeServer.listen(0, '127.0.0.1', resolve));
  const address = nodeServer.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(nodeServer),
  };
};

const requestWithBody = (
  url: string,
  method: string,
  body: string,
  headers: Record<string, string> = {},
) =>
  new Promise<{ status: number; bodyText: string }>((resolve, reject) => {
    const target = new URL(url);
    const req = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          ...headers,
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let bodyText = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          bodyText += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, bodyText }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });

describe('HTTP runtime adapter request parsing', () => {
  it('returns invalid_json for malformed JSON and does not write snapshots', async () => {
    const server = await createHttpTestServer();
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const response = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: { code: 'invalid_json', message: 'Request body is not valid JSON.' } });
      expect(snapshotCount(server.repository.database)).toBe(beforeCount);
    } finally {
      await server.close();
    }
  });

  it('returns request_body_too_large and unsupported_media_type before forwarding', async () => {
    const server = await createHttpTestServer({ maxBodyBytes: 4 });
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const tooLarge = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"abc":true}',
      });
      expect(tooLarge).toMatchObject({ status: 413, body: { error: { code: 'request_body_too_large' } } });
      expect(snapshotCount(server.repository.database)).toBe(beforeCount);
    } finally {
      await server.close();
    }

    const unsupportedServer = await createHttpTestServer();
    try {
      const beforeCount = snapshotCount(unsupportedServer.repository.database);
      const unsupported = await fetchJson(`${unsupportedServer.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });
      expect(unsupported).toMatchObject({ status: 415, body: { error: { code: 'unsupported_media_type' } } });
      expect(snapshotCount(unsupportedServer.repository.database)).toBe(beforeCount);
    } finally {
      await unsupportedServer.close();
    }
  });

  it('allows empty POST body without Content-Type and forwards body as undefined', async () => {
    const adapter = fakeAdapter();
    const realServer = await listenWithAdapter(adapter);
    try {
      const response = await fetchJson(`${realServer.url}/sessions/start`, { method: 'POST' });
      expect(response.status).toBe(200);
      expect(adapter.requests[0]).toMatchObject({ method: 'POST', path: '/sessions/start' });
      expect(adapter.requests[0]).not.toHaveProperty('body');
    } finally {
      await realServer.close();
    }
  });

  it('parses query strings and forwards JSON bodies', async () => {
    const adapter = fakeAdapter();
    const realServer = await listenWithAdapter(adapter);
    try {
      await fetchJson(`${realServer.url}/sessions/start?source=http&source=last`, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: '{"templateId":"push-a"}',
      });
      expect(adapter.requests[0]).toMatchObject({
        method: 'POST',
        path: '/sessions/start',
        query: { source: 'last' },
        body: { templateId: 'push-a' },
      });
    } finally {
      await realServer.close();
    }
  });

  it('does not read GET or HEAD bodies and forwards HEAD to serverAdapter', async () => {
    const adapter = fakeAdapter();
    const realServer = await listenWithAdapter(adapter);
    try {
      await requestWithBody(`${realServer.url}/health`, 'GET', '{"ignored":true}', { 'content-type': 'application/json' });
      const head = await requestWithBody(`${realServer.url}/health`, 'HEAD', '{"ignored":true}', { 'content-type': 'application/json' });

      expect(adapter.requests[0]).toMatchObject({ method: 'GET', path: '/health' });
      expect(adapter.requests[0]).not.toHaveProperty('body');
      expect(adapter.requests[1]).toMatchObject({ method: 'HEAD', path: '/health' });
      expect(adapter.requests[1]).not.toHaveProperty('body');
      expect(head.status).toBe(200);
    } finally {
      await realServer.close();
    }
  });
});
