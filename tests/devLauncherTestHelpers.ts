import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import { closeServer, fetchJson } from './httpRuntimeAdapterTestHelpers';

export const DEV_LAUNCHER_NOW = '2026-05-10T12:00:00.000Z';

export const makeTempDevDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ironpath-dev-launcher-'));
  const dbFile = join(dir, 'dev-api.sqlite');
  const cleanup = () => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  };
  return { dir, dbFile, cleanup };
};

export const startDevLauncher = async ({
  dbFile,
  seedEmpty = true,
  host,
  port = 0,
  allowNetworkAccess,
  maxBodyBytes,
}: {
  dbFile: string;
  seedEmpty?: boolean;
  host?: string;
  port?: number;
  allowNetworkAccess?: boolean;
  maxBodyBytes?: number;
}) => {
  const launcher = createDevLocalApiLauncher({
    dbFile,
    seedEmpty,
    host,
    port,
    allowNetworkAccess,
    maxBodyBytes,
    clock: () => DEV_LAUNCHER_NOW,
  });
  const started = await launcher.start();
  return { launcher, started };
};

export const fetchLauncherJson = fetchJson;

export const occupyLocalPort = async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 204;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local TCP address.');
  return {
    port: address.port,
    server,
    close: () => closeServer(server as Server),
  };
};
