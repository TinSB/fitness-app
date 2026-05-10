import { describe, expect, it } from 'vitest';
import {
  buildDevApiRunnerHelpText,
  parseDevApiRunnerArgs,
  runDevApiRunnerCli,
} from '../apps/api/src/node/devApiRunner';

describe('dev API runner CLI helpers', () => {
  it('imports without auto-listening and prints dev-only help', () => {
    const help = buildDevApiRunnerHelpText();

    expect(help).toContain('IronPath dev-only local API runner');
    expect(help).toContain('--host <host>');
    expect(help).toContain('--port <port>');
    expect(help).toContain('--db <file>');
    expect(help).toContain('--seed-empty');
    expect(help).toContain('--allow-network-access');
    expect(help).toContain('No auth, sync, production server, App.tsx integration, UI integration, or localStorage replacement');
  });

  it('parses defaults and explicit CLI arguments', () => {
    expect(parseDevApiRunnerArgs([])).toMatchObject({
      host: '127.0.0.1',
      port: 8787,
      dbFile: '.ironpath/dev-api.sqlite',
      seedEmpty: false,
      allowNetworkAccess: false,
      help: false,
    });

    expect(
      parseDevApiRunnerArgs([
        '--host',
        'localhost',
        '--port',
        '0',
        '--db',
        'tmp.sqlite',
        '--seed-empty',
        '--allow-network-access',
        '--max-body-bytes',
        '2048',
      ]),
    ).toMatchObject({
      host: 'localhost',
      port: 0,
      dbFile: 'tmp.sqlite',
      seedEmpty: true,
      allowNetworkAccess: true,
      maxBodyBytes: 2048,
    });
  });

  it('returns stable errors for invalid args and unsafe host startup', async () => {
    expect(() => parseDevApiRunnerArgs(['--port', '-1'])).toThrow(/--port/);
    expect(() => parseDevApiRunnerArgs(['--unknown'])).toThrow(/Unknown argument/);

    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = await runDevApiRunnerCli(['--host', '192.0.2.10', '--port', '0'], {
      log: (line: string) => logs.push(line),
      error: (line: string) => errors.push(line),
    });

    expect(exitCode).toBe(1);
    expect(logs).toEqual([]);
    expect(errors.join('\n')).toContain('dev_launcher_network_access_denied');
    expect(errors.join('\n')).not.toContain('stack');
    expect(errors.join('\n')).not.toContain('Error:');
  });
});
