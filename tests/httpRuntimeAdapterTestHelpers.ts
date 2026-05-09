import { createServer, type Server } from 'node:http';
import {
  createHttpRequestListener,
  createServerAdapter,
  createSqliteRepository,
  type ServerAdapterResponse,
} from '../apps/api/src/node';
import type { AppData } from '../src/models/training-model';
import { makeAppData } from './fixtures';

export type HttpJsonResponse = {
  status: number;
  headers: Headers;
  bodyText: string;
  body: unknown;
};

export const HTTP_NOW = '2026-05-09T12:00:00.000Z';

export const createHttpTestServer = async ({
  data = makeAppData(),
  maxBodyBytes,
  serverAdapter,
}: {
  data?: AppData | null;
  maxBodyBytes?: number;
  serverAdapter?: ReturnType<typeof createServerAdapter>;
} = {}) => {
  const repository = createSqliteRepository();
  if (data) {
    repository.writeSnapshot(data, {
      snapshotId: 'http-seed',
      createdAt: '2026-05-09T10:00:00.000Z',
      label: 'seed',
    });
  }
  const adapter = serverAdapter || createServerAdapter({ repository, clock: () => HTTP_NOW });
  const server = createServer(createHttpRequestListener({ serverAdapter: adapter, maxBodyBytes }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server did not bind to a port.');
  const url = `http://127.0.0.1:${address.port}`;

  const close = async () => {
    await closeServer(server);
    repository.close();
  };

  return { repository, adapter, server, url, close };
};

export const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });

export const fetchJson = async (url: string, init?: RequestInit): Promise<HttpJsonResponse> => {
  const response = await fetch(url, init);
  const bodyText = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    bodyText,
    body: bodyText ? (JSON.parse(bodyText) as unknown) : undefined,
  };
};

export const wrapAdapterResponse = (response: ServerAdapterResponse) =>
  response.error
    ? { error: response.error }
    : {
        result: response.result,
        ...(response.snapshot ? { snapshot: response.snapshot } : {}),
      };
