import { pathToFileURL } from 'node:url';
import {
  createDevLocalApiLauncher,
  DEV_LAUNCHER_DEFAULT_DB_FILE,
  DEV_LAUNCHER_DEFAULT_HOST,
  DEV_LAUNCHER_DEFAULT_PORT,
  DevLocalApiLauncherError,
  type CreateDevLocalApiLauncherOptions,
} from './devLauncher';

export const DEV_API_RUNNER_READY_PREFIX = 'IronPath dev API ready: ';

export type DevApiRunnerCliOptions = {
  host: string;
  port: number;
  dbFile: string;
  seedEmpty: boolean;
  allowNetworkAccess: boolean;
  maxBodyBytes?: number;
  help: boolean;
};

export type DevApiRunnerCliErrorCode =
  | 'dev_api_runner_invalid_argument'
  | 'dev_api_runner_start_failed';

export class DevApiRunnerCliError extends Error {
  code: DevApiRunnerCliErrorCode;

  constructor(code: DevApiRunnerCliErrorCode, message: string) {
    super(message);
    this.name = 'DevApiRunnerCliError';
    this.code = code;
  }
}

const defaultOptions = (): DevApiRunnerCliOptions => ({
  host: DEV_LAUNCHER_DEFAULT_HOST,
  port: DEV_LAUNCHER_DEFAULT_PORT,
  dbFile: DEV_LAUNCHER_DEFAULT_DB_FILE,
  seedEmpty: false,
  allowNetworkAccess: false,
  help: false,
});

const readValue = (args: string[], index: number, flag: string) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new DevApiRunnerCliError('dev_api_runner_invalid_argument', `${flag} requires a value.`);
  }
  return value;
};

const parsePositiveInteger = (value: string, flag: string, allowZero = false) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new DevApiRunnerCliError('dev_api_runner_invalid_argument', `${flag} must be a positive integer${allowZero ? ' or 0' : ''}.`);
  }
  return parsed;
};

export const parseDevApiRunnerArgs = (args: string[]): DevApiRunnerCliOptions => {
  const options = defaultOptions();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--seed-empty') {
      options.seedEmpty = true;
      continue;
    }
    if (arg === '--allow-network-access') {
      options.allowNetworkAccess = true;
      continue;
    }
    if (arg === '--host') {
      options.host = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--port') {
      options.port = parsePositiveInteger(readValue(args, index, arg), arg, true);
      index += 1;
      continue;
    }
    if (arg === '--db') {
      options.dbFile = readValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--max-body-bytes') {
      options.maxBodyBytes = parsePositiveInteger(readValue(args, index, arg), arg);
      index += 1;
      continue;
    }
    throw new DevApiRunnerCliError('dev_api_runner_invalid_argument', `Unknown argument: ${arg}`);
  }

  return options;
};

export const buildDevApiRunnerHelpText = () => [
  'IronPath dev-only local API runner',
  '',
  'Usage:',
  '  npm run api:dev -- [--host 127.0.0.1] [--port 8787] [--db .ironpath/dev-api.sqlite] [--seed-empty]',
  '',
  'Options:',
  '  --host <host>                Bind host. Default: 127.0.0.1',
  '  --port <port>                Bind port. Use 0 for an ephemeral port. Default: 8787',
  '  --db <file>                  SQLite snapshot DB file. Default: .ironpath/dev-api.sqlite',
  '  --seed-empty                 Seed empty AppData only when no latest snapshot exists.',
  '  --allow-network-access       Allow non-localhost bind. Required for 0.0.0.0 or LAN hosts.',
  '  --max-body-bytes <bytes>     Override JSON body size limit.',
  '  --help                       Print this dev-only usage text.',
  '',
  'Boundaries:',
  '  Dev-only. No auth, sync, production server, App.tsx integration, UI integration, or localStorage replacement.',
].join('\n');

const toLauncherOptions = (options: DevApiRunnerCliOptions): CreateDevLocalApiLauncherOptions => ({
  host: options.host,
  port: options.port,
  dbFile: options.dbFile,
  seedEmpty: options.seedEmpty,
  allowNetworkAccess: options.allowNetworkAccess,
  maxBodyBytes: options.maxBodyBytes,
});

const stableError = (error: unknown) => {
  if (error instanceof DevApiRunnerCliError || error instanceof DevLocalApiLauncherError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'dev_api_runner_start_failed',
    message: 'IronPath dev API runner could not start.',
  };
};

export const runDevApiRunnerCli = async (
  args: string[],
  io: Pick<typeof console, 'log' | 'error'> = console,
): Promise<number> => {
  let launcher: ReturnType<typeof createDevLocalApiLauncher> | null = null;
  let shuttingDown = false;

  try {
    const options = parseDevApiRunnerArgs(args);
    if (options.help) {
      io.log(buildDevApiRunnerHelpText());
      return 0;
    }

    launcher = createDevLocalApiLauncher(toLauncherOptions(options));
    const closeAndExit = async (exitCode: number) => {
      if (shuttingDown) return;
      shuttingDown = true;
      await launcher?.close();
      process.exitCode = exitCode;
    };

    process.once('SIGINT', () => {
      void closeAndExit(0);
    });
    process.once('SIGTERM', () => {
      void closeAndExit(0);
    });

    const started = await launcher.start();
    io.log(`${DEV_API_RUNNER_READY_PREFIX}${started.url}`);
    return 0;
  } catch (error) {
    await launcher?.close();
    const stable = stableError(error);
    io.error(`IronPath dev API error: ${stable.code}: ${stable.message}`);
    return 1;
  }
};

const isMainModule = () => {
  const argvEntry = process.argv[1];
  return Boolean(argvEntry && import.meta.url === pathToFileURL(argvEntry).href);
};

if (isMainModule()) {
  void runDevApiRunnerCli(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
