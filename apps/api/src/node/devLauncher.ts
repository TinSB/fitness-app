import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, resolve } from 'node:path';
import { emptyData } from '../../../../src/storage/appDataSanitize';
import { createSqliteRepository, SqliteRepositoryError } from '../sqliteRepository';
import { createHttpRequestListener } from './httpRuntimeAdapter';
import { createServerAdapter } from './serverAdapter';

export const DEV_LAUNCHER_DEFAULT_HOST = '127.0.0.1';
export const DEV_LAUNCHER_DEFAULT_PORT = 8787;
export const DEV_LAUNCHER_DEFAULT_DB_FILE = '.ironpath/dev-api.sqlite';
export const DEV_LAUNCHER_SEED_EMPTY_LABEL = 'dev-launcher:seed-empty';
export const DEV_LAUNCHER_FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6697, 10080,
]);
export const DEV_LAUNCHER_MAX_EPHEMERAL_PORT_ATTEMPTS = 10;

export type DevLocalApiLauncherErrorCode =
  | 'dev_launcher_network_access_denied'
  | 'dev_launcher_already_started'
  | 'dev_launcher_start_failed';

export class DevLocalApiLauncherError extends Error {
  code: DevLocalApiLauncherErrorCode;

  constructor(code: DevLocalApiLauncherErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'DevLocalApiLauncherError';
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', { value: cause, enumerable: false });
    }
  }
}

export type DevLocalApiLauncherStartResult = {
  url: string;
  host: string;
  port: number;
};

export type CreateDevLocalApiLauncherOptions = {
  dbFile?: string;
  host?: string;
  port?: number;
  maxBodyBytes?: number;
  clock?: () => string;
  seedEmpty?: boolean;
  allowNetworkAccess?: boolean;
};

type SqliteRepository = ReturnType<typeof createSqliteRepository>;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const normalizeHost = (host: string | undefined) => (host || DEV_LAUNCHER_DEFAULT_HOST).trim() || DEV_LAUNCHER_DEFAULT_HOST;

const isLocalHost = (host: string) => LOCAL_HOSTS.has(host.toLowerCase());

export const isDevLauncherFetchBlockedPort = (port: number) =>
  DEV_LAUNCHER_FETCH_BLOCKED_PORTS.has(port);

const assertSafeHost = (host: string, allowNetworkAccess: boolean | undefined) => {
  if (isLocalHost(host) || allowNetworkAccess === true) return;
  throw new DevLocalApiLauncherError(
    'dev_launcher_network_access_denied',
    'Dev local API launcher refuses to bind a non-localhost host without allowNetworkAccess=true.',
  );
};

const nowIso = (clock?: () => string) => clock?.() || new Date().toISOString();

const formatUrlHost = (host: string) => {
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host.startsWith('[') && host.endsWith(']')) return host;
  return host.includes(':') ? `[${host}]` : host;
};

const listen = (server: Server, port: number, host: string): Promise<AddressInfo> =>
  new Promise((resolveListen, rejectListen) => {
    const cleanup = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      rejectListen(error);
    };
    const onListening = () => {
      cleanup();
      const address = server.address();
      if (!address || typeof address === 'string') {
        rejectListen(new Error('Dev local API launcher did not bind to a TCP port.'));
        return;
      }
      resolveListen(address);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

const closeServer = (server: Server | null) =>
  new Promise<void>((resolveClose) => {
    if (!server || !server.listening) {
      resolveClose();
      return;
    }
    server.close(() => resolveClose());
  });

const wrapStartError = (error: unknown) => {
  if (error instanceof DevLocalApiLauncherError) return error;
  return new DevLocalApiLauncherError('dev_launcher_start_failed', 'Dev local API launcher could not start.', error);
};

const seedEmptyIfRequested = (repository: SqliteRepository, clock?: () => string) => {
  try {
    repository.readSnapshot();
    return;
  } catch (error) {
    if (!(error instanceof SqliteRepositoryError) || error.code !== 'snapshot_not_found') {
      throw error;
    }
  }

  repository.writeSnapshot(emptyData(), {
    createdAt: nowIso(clock),
    label: DEV_LAUNCHER_SEED_EMPTY_LABEL,
  });
};

export const createDevLocalApiLauncher = (options: CreateDevLocalApiLauncherOptions = {}) => {
  const host = normalizeHost(options.host);
  const port = options.port ?? DEV_LAUNCHER_DEFAULT_PORT;
  const dbFile = resolve(options.dbFile || DEV_LAUNCHER_DEFAULT_DB_FILE);

  let repository: SqliteRepository | null = null;
  let server: Server | null = null;
  let started: DevLocalApiLauncherStartResult | null = null;
  let starting: Promise<DevLocalApiLauncherStartResult> | null = null;

  const closeOpenedResources = async (openedServer: Server | null, openedRepository: SqliteRepository | null) => {
    await closeServer(openedServer);
    openedRepository?.close();
  };

  const startInternal = async (): Promise<DevLocalApiLauncherStartResult> => {
    assertSafeHost(host, options.allowNetworkAccess);
    mkdirSync(dirname(dbFile), { recursive: true });

    let openedRepository: SqliteRepository | null = null;
    let openedServer: Server | null = null;

    try {
      openedRepository = createSqliteRepository({ filename: dbFile });
      if (options.seedEmpty === true) {
        seedEmptyIfRequested(openedRepository, options.clock);
      }

      let address: AddressInfo | null = null;
      for (let attempt = 0; attempt < DEV_LAUNCHER_MAX_EPHEMERAL_PORT_ATTEMPTS; attempt += 1) {
        const serverAdapter = createServerAdapter({ repository: openedRepository, clock: options.clock });
        openedServer = createServer(
          createHttpRequestListener({
            serverAdapter,
            maxBodyBytes: options.maxBodyBytes,
          }),
        );

        address = await listen(openedServer, port, host);
        if (port !== 0 || !isDevLauncherFetchBlockedPort(address.port)) break;

        await closeServer(openedServer);
        openedServer = null;
        address = null;
      }

      if (!address) {
        throw new Error('Dev local API launcher could not bind to a fetch-safe ephemeral port.');
      }

      repository = openedRepository;
      server = openedServer;
      started = {
        host,
        port: address.port,
        url: `http://${formatUrlHost(host)}:${address.port}`,
      };
      return started;
    } catch (error) {
      await closeOpenedResources(openedServer, openedRepository);
      throw wrapStartError(error);
    }
  };

  const start = () => {
    if (started) return Promise.resolve(started);
    if (starting) return starting;
    starting = startInternal().finally(() => {
      starting = null;
    });
    return starting;
  };

  const close = async () => {
    if (starting) {
      try {
        await starting;
      } catch {
        // A failed start already cleans up its opened resources.
      }
    }
    await closeServer(server);
    server = null;
    repository?.close();
    repository = null;
    started = null;
  };

  return {
    start,
    close,
  };
};
