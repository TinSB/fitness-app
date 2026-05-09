import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createHttpRequestListener, createServerAdapter, createSqliteRepository } from '../apps/api/src/node';
import { closeServer, fetchJson } from './httpRuntimeAdapterTestHelpers';

describe('HTTP runtime adapter lifecycle', () => {
  it('can be hosted on an ephemeral test server and closed without auto-listening production behavior', async () => {
    const repository = createSqliteRepository();
    const adapter = createServerAdapter({ repository });
    const listener = createHttpRequestListener({ serverAdapter: adapter });
    const server = createServer(listener);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    expect(address).toBeTruthy();
    expect(typeof address).not.toBe('string');

    const url = `http://127.0.0.1:${(address as { port: number }).port}`;
    const response = await fetchJson(`${url}/health`);
    expect(response.status).toBe(200);

    await closeServer(server);
    await closeServer(server);
    repository.close();
  });
});
