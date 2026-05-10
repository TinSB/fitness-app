import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDevDbArtifacts, createSqliteRepository } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { makeTempRunnerDb } from './devApiRunnerTestHelpers';

describe('dev DB recovery backup', () => {
  it('copies existing sqlite artifacts and skips missing artifacts', () => {
    const temp = makeTempRunnerDb();
    try {
      const repo = createSqliteRepository({ filename: temp.dbFile });
      repo.writeSnapshot(makeAppData(), { snapshotId: 'backup-seed', createdAt: '2026-05-10T10:00:00.000Z' });
      repo.close();
      writeFileSync(`${temp.dbFile}-wal`, 'wal', 'utf8');
      writeFileSync(`${temp.dbFile}-shm`, 'shm', 'utf8');
      writeFileSync(`${temp.dbFile}-journal`, 'journal', 'utf8');
      writeFileSync(join(temp.dir, 'unrelated.json'), '{}', 'utf8');
      writeFileSync(join(temp.dir, 'dev-api-runner'), 'runner-output-placeholder', 'utf8');

      const result = backupDevDbArtifacts({
        dbFile: temp.dbFile,
        backupDir: join(temp.dir, 'backup-target'),
        nowIso: '2026-05-10T10:11:12.000Z',
      });

      expect(result.createdAt).toBe('2026-05-10T10:11:12.000Z');
      expect(result.copiedArtifacts.map((artifact) => artifact.kind).sort()).toEqual(['journal', 'main', 'shm', 'wal']);
      expect(result.skippedArtifacts).toEqual([]);
      result.copiedArtifacts.forEach((artifact) => expect(existsSync(artifact.path), artifact.path).toBe(true));
      expect(existsSync(join(result.backupDir, 'unrelated.json'))).toBe(false);
      expect(existsSync(join(result.backupDir, 'dev-api-runner'))).toBe(false);
      expect(readFileSync(`${temp.dbFile}-wal`, 'utf8')).toBe('wal');
    } finally {
      temp.cleanup();
    }
  });

  it('returns skipped artifacts without throwing when no DB artifacts exist', () => {
    const temp = makeTempRunnerDb();
    try {
      const result = backupDevDbArtifacts({
        dbFile: temp.dbFile,
        backupDir: join(temp.dir, 'empty-backup'),
        nowIso: '2026-05-10T10:11:12.000Z',
        label: 'needs reset',
      });

      expect(result.copiedArtifacts).toEqual([]);
      expect(result.skippedArtifacts.map((artifact) => artifact.kind).sort()).toEqual(['journal', 'main', 'shm', 'wal']);
      expect(result.backupDir).toContain('empty-backup');
      expect(JSON.stringify(result)).not.toContain('stack');
    } finally {
      temp.cleanup();
    }
  });

  it('uses a filesystem-safe default backup directory', () => {
    const temp = makeTempRunnerDb();
    let backupDir: string | undefined;
    try {
      const repo = createSqliteRepository({ filename: temp.dbFile });
      repo.writeSnapshot(makeAppData(), { snapshotId: 'safe-backup-seed', createdAt: '2026-05-10T10:00:00.000Z' });
      repo.close();

      const result = backupDevDbArtifacts({
        dbFile: temp.dbFile,
        nowIso: '2026-05-10T10:11:12.000Z',
        label: 'manual reset',
      });
      backupDir = result.backupDir;

      expect(result.backupDir).toContain('2026-05-10T10-11-12.000Z-manual-reset');
      expect(basename(result.backupDir)).not.toContain(':');
    } finally {
      if (backupDir) rmSync(backupDir, { recursive: true, force: true });
      temp.cleanup();
    }
  });
});
