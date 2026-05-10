import { describe, expect, it } from 'vitest';
import {
  backupDevDbArtifacts,
  createDevLocalApiLauncher,
  DEV_DB_RESET_CONFIRM_TOKEN,
  resetDevDbArtifacts,
} from '../apps/api/src/node';
import { countSnapshotsInFile, fetchJsonWithTimeout } from './devRuntimeSmokeTestHelpers';
import { makeTempRunnerDb } from './devApiRunnerTestHelpers';
import { readSource } from './runtimeBoundaryTestHelpers';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dev DB recovery runner compatibility', () => {
  it('backs up and resets a launcher-created DB without an HTTP reset endpoint', async () => {
    const temp = makeTempRunnerDb();
    const resetBackupTarget = resolve(
      process.cwd(),
      '.ironpath',
      'backups',
      'dev-api',
      '2026-05-10T10-06-00.000Z-pre-reset',
    );
    const firstLauncher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: true,
      clock: () => '2026-05-10T10:00:00.000Z',
    });

    try {
      rmSync(resetBackupTarget, { recursive: true, force: true });
      const first = await firstLauncher.start();
      const firstSummary = await fetchJsonWithTimeout(`${first.url}/app-data/summary`, {}, 1_000);
      expect(firstSummary.status).toBe(200);
      await firstLauncher.close();

      const backup = backupDevDbArtifacts({
        dbFile: temp.dbFile,
        backupDir: `${temp.dir}/backup`,
        nowIso: '2026-05-10T10:05:00.000Z',
      });
      expect(backup.copiedArtifacts.some((artifact) => artifact.kind === 'main')).toBe(true);

      resetDevDbArtifacts({
        dbFile: temp.dbFile,
        confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
        allowOutsideIronPath: true,
        backupFirst: true,
        nowIso: '2026-05-10T10:06:00.000Z',
      });

      const emptyLauncher = createDevLocalApiLauncher({
        dbFile: temp.dbFile,
        port: 0,
        seedEmpty: false,
      });
      try {
        const empty = await emptyLauncher.start();
        const missingSummary = await fetchJsonWithTimeout(`${empty.url}/app-data/summary`, {}, 1_000);
        expect(missingSummary.status).toBe(404);
        expect(missingSummary.body).toMatchObject({ error: { code: 'snapshot_not_found' } });
      } finally {
        await emptyLauncher.close();
      }

      const reseedLauncher = createDevLocalApiLauncher({
        dbFile: temp.dbFile,
        port: 0,
        seedEmpty: true,
        clock: () => '2026-05-10T10:07:00.000Z',
      });
      try {
        const reseeded = await reseedLauncher.start();
        const reseededSummary = await fetchJsonWithTimeout(`${reseeded.url}/app-data/summary`, {}, 1_000);
        expect(reseededSummary.status).toBe(200);
      } finally {
        await reseedLauncher.close();
      }
      expect(countSnapshotsInFile(temp.dbFile)).toBe(1);

      const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(Object.keys(packageJson.scripts).filter((name) => /reset|recovery|backup/i.test(name))).toEqual([]);
      expect(readSource('apps/api/src/node/serverAdapter.ts')).not.toContain('resetDevDbArtifacts');
      expect(readSource('apps/api/src/node/httpRuntimeAdapter.ts')).not.toContain('resetDevDbArtifacts');
    } finally {
      await firstLauncher.close();
      rmSync(resetBackupTarget, { recursive: true, force: true });
      temp.cleanup();
    }
  });
});
