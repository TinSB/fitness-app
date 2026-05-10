import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createSqliteRepository,
  DEV_DB_RESET_CONFIRM_TOKEN,
  DevDbRecoveryError,
  resetDevDbArtifacts,
} from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { makeTempRunnerDb } from './devApiRunnerTestHelpers';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const seedArtifacts = (dbFile: string) => {
  const repo = createSqliteRepository({ filename: dbFile });
  repo.writeSnapshot(makeAppData(), { snapshotId: 'reset-seed', createdAt: '2026-05-10T10:00:00.000Z' });
  repo.close();
  writeFileSync(`${dbFile}-wal`, 'wal', 'utf8');
  writeFileSync(`${dbFile}-shm`, 'shm', 'utf8');
  writeFileSync(`${dbFile}-journal`, 'journal', 'utf8');
};

const expectDevDbError = (operation: () => unknown, code: string) => {
  try {
    operation();
    throw new Error('Expected DevDbRecoveryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(DevDbRecoveryError);
    expect((error as DevDbRecoveryError).code).toBe(code);
    expect(JSON.stringify(error)).not.toContain('stack');
  }
};

describe('dev DB recovery reset safety', () => {
  it('requires confirmation and supports dry-run without deleting files', () => {
    const temp = makeTempRunnerDb();
    try {
      seedArtifacts(temp.dbFile);
      expectDevDbError(
        () => resetDevDbArtifacts({ dbFile: temp.dbFile, confirmToken: 'WRONG', allowOutsideIronPath: true }),
        'dev_db_confirmation_required',
      );
      expect(existsSync(temp.dbFile)).toBe(true);

      const dryRun = resetDevDbArtifacts({
        dbFile: temp.dbFile,
        confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
        allowOutsideIronPath: true,
        dryRun: true,
      });

      expect(dryRun.dryRun).toBe(true);
      expect(dryRun.deletedArtifacts.map((artifact) => artifact.kind).sort()).toEqual(['journal', 'main', 'shm', 'wal']);
      expect(existsSync(temp.dbFile)).toBe(true);
      expect(existsSync(`${temp.dbFile}-wal`)).toBe(true);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects outside-.ironpath reset unless explicitly allowed', () => {
    const temp = makeTempRunnerDb();
    try {
      seedArtifacts(temp.dbFile);
      expectDevDbError(
        () => resetDevDbArtifacts({ dbFile: temp.dbFile, confirmToken: DEV_DB_RESET_CONFIRM_TOKEN }),
        'dev_db_outside_allowed_dir',
      );
      expect(existsSync(temp.dbFile)).toBe(true);
    } finally {
      temp.cleanup();
    }
  });

  it('deletes only sqlite artifacts after backup and preserves unrelated files, dirs, and backup output', () => {
    const temp = makeTempRunnerDb();
    const defaultBackupTarget = resolve(
      repoRoot(),
      '.ironpath',
      'backups',
      'dev-api',
      '2026-05-10T10-20-00.000Z-pre-reset',
    );
    try {
      rmSync(defaultBackupTarget, { recursive: true, force: true });
      seedArtifacts(temp.dbFile);
      const unrelated = join(temp.dir, 'unrelated.json');
      const runnerOutput = join(temp.dir, 'dev-api-runner');
      const backupDir = join(temp.dir, 'manual-backup');
      writeFileSync(unrelated, '{}', 'utf8');
      mkdirSync(runnerOutput);
      mkdirSync(backupDir);

      const result = resetDevDbArtifacts({
        dbFile: temp.dbFile,
        confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
        allowOutsideIronPath: true,
        nowIso: '2026-05-10T10:20:00.000Z',
      });

      expect(result.backup?.copiedArtifacts.length).toBeGreaterThan(0);
      expect(result.deletedArtifacts.map((artifact) => artifact.kind).sort()).toEqual(['journal', 'main', 'shm', 'wal']);
      expect(existsSync(temp.dbFile)).toBe(false);
      expect(existsSync(`${temp.dbFile}-wal`)).toBe(false);
      expect(existsSync(`${temp.dbFile}-shm`)).toBe(false);
      expect(existsSync(`${temp.dbFile}-journal`)).toBe(false);
      expect(existsSync(unrelated)).toBe(true);
      expect(existsSync(runnerOutput)).toBe(true);
      expect(existsSync(backupDir)).toBe(true);
    } finally {
      rmSync(defaultBackupTarget, { recursive: true, force: true });
      temp.cleanup();
    }
  });

  it('rejects unsafe path suffixes and symlink artifacts without deleting targets', () => {
    const temp = makeTempRunnerDb();
    try {
      expectDevDbError(
        () =>
          resetDevDbArtifacts({
            dbFile: join(temp.dir, 'dev-api.sqlite.backup'),
            confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
            allowOutsideIronPath: true,
          }),
        'dev_db_invalid_path',
      );

      const outside = join(temp.dir, 'outside.sqlite');
      const link = join(temp.dir, 'linked.sqlite');
      writeFileSync(outside, 'outside', 'utf8');
      try {
        symlinkSync(outside, link);
      } catch (error) {
        expect(String(error)).toMatch(/EPERM|privilege|operation not permitted|not allowed/i);
        return;
      }

      expectDevDbError(
        () =>
          resetDevDbArtifacts({
            dbFile: link,
            confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
            allowOutsideIronPath: true,
            backupFirst: false,
          }),
        'dev_db_artifact_unsafe',
      );
      expect(existsSync(outside)).toBe(true);
    } finally {
      temp.cleanup();
    }
  });

  it('does not delete when backup fails', () => {
    const temp = makeTempRunnerDb();
    const blockedBackupTarget = resolve(
      repoRoot(),
      '.ironpath',
      'backups',
      'dev-api',
      '2026-05-10T10-20-00.000Z-pre-reset',
    );
    try {
      seedArtifacts(temp.dbFile);
      rmSync(blockedBackupTarget, { recursive: true, force: true });
      mkdirSync(join(blockedBackupTarget, '..'), { recursive: true });
      writeFileSync(blockedBackupTarget, 'not-a-directory', 'utf8');

      expectDevDbError(
        () =>
          resetDevDbArtifacts({
            dbFile: temp.dbFile,
            confirmToken: DEV_DB_RESET_CONFIRM_TOKEN,
            allowOutsideIronPath: true,
            nowIso: '2026-05-10T10:20:00.000Z',
          }),
        'dev_db_backup_failed',
      );
      expect(existsSync(temp.dbFile)).toBe(true);
    } finally {
      rmSync(blockedBackupTarget, { recursive: true, force: true });
      temp.cleanup();
    }
  });
});
