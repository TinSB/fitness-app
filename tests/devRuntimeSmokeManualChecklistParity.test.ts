import { describe, expect, it } from 'vitest';
import {
  DEV_LAUNCHER_DEFAULT_HOST,
  DEV_LAUNCHER_SEED_EMPTY_LABEL,
  SERVER_ADAPTER_ROUTES,
} from '../apps/api/src/node';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import {
  DEV_RUNTIME_SMOKE_NOW,
  countSnapshotsInFile,
  fetchJsonWithTimeout,
  makeTempDevRuntimeDb,
} from './devRuntimeSmokeTestHelpers';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('dev runtime smoke manual checklist parity', () => {
  it('keeps documented routes aligned with the server adapter registry', () => {
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');

    SERVER_ADAPTER_ROUTES.forEach((route) => {
      expect(checklist).toContain(`${route.method} ${route.path}`);
    });
  });

  it('keeps documented response shape aligned with actual HTTP responses', async () => {
    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: true,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();
      const success = await fetchJsonWithTimeout(`${started.url}/health`);
      const failure = await fetchJsonWithTimeout(`${started.url}/missing`);

      expect(success.status).toBe(200);
      expect(success.body).toHaveProperty('result');
      expect(success.body).not.toHaveProperty('error');
      expect(failure.status).toBe(404);
      expect(failure.body).toMatchObject({ result: { reasonCode: 'unsupported_route', message: expect.any(String) } });
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('keeps documented seed and launcher boundaries aligned with constants and behavior', async () => {
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');

    expect(checklist).toContain(`Default host is \`${DEV_LAUNCHER_DEFAULT_HOST}\``);
    expect(checklist).toContain(`The seed snapshot label is \`${DEV_LAUNCHER_SEED_EMPTY_LABEL}\``);
    expect(checklist).not.toMatch(/\bapi:dev\b/i);
    expect(checklist).not.toMatch(/\bnpm run api\b/i);
    expect(checklist).toContain('no App.tsx integration');
    expect(checklist).toContain('no UI integration');

    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: true,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      await launcher.start();
      expect(countSnapshotsInFile(temp.dbFile)).toBe(1);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
