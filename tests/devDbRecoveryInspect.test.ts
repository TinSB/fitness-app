import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertNodeSqliteAvailable,
  createSqliteRepository,
  inspectDevDbState,
} from '../apps/api/src/node';
import { makeAppData } from './fixtures';

const makeTempInspectDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ironpath-dev-db-inspect-'));
  const dbFile = join(dir, 'inspect.sqlite');
  const cleanup = () => {
    // Inspect tests do not spawn a runner, so avoid runner-process scanning during cleanup.
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  };
  return { dir, dbFile, cleanup };
};

const metadataCount = (dbFile: string) => {
  const DatabaseSync = assertNodeSqliteAvailable();
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return (
      db
        .prepare("SELECT COUNT(*) AS count FROM app_meta WHERE key = 'repository_schema_version'")
        .get() as { count: number }
    ).count;
  } finally {
    db.close();
  }
};

describe('dev DB recovery inspect', () => {
  it('does not create a missing DB file', () => {
    const temp = makeTempInspectDb();
    try {
      const state = inspectDevDbState({ dbFile: temp.dbFile });

      expect(state.exists).toBe(false);
      expect(state.canOpen).toBe(false);
      expect(state.hasLatestSnapshot).toBe(false);
      expect(existsSync(temp.dbFile)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('reports an existing repository with no snapshots without writing snapshots', () => {
    const temp = makeTempInspectDb();
    try {
      const repo = createSqliteRepository({ filename: temp.dbFile });
      repo.close();

      const beforeMetadata = metadataCount(temp.dbFile);
      const state = inspectDevDbState({ dbFile: temp.dbFile });
      const afterMetadata = metadataCount(temp.dbFile);

      expect(state.exists).toBe(true);
      expect(state.canOpen).toBe(true);
      expect(state.hasLatestSnapshot).toBe(false);
      expect(state.error).toBeUndefined();
      expect(beforeMetadata).toBe(1);
      expect(afterMetadata).toBe(1);
    } finally {
      temp.cleanup();
    }
  });

  it('reports latest snapshot metadata for a seeded repository and closes handles', () => {
    const temp = makeTempInspectDb();
    try {
      const repo = createSqliteRepository({ filename: temp.dbFile });
      const seeded = makeAppData();
      repo.writeSnapshot(seeded, {
        snapshotId: 'inspect-seed',
        createdAt: '2026-05-10T10:00:00.000Z',
        label: 'inspect-test',
      });
      repo.close();

      const state = inspectDevDbState({ dbFile: temp.dbFile });

      expect(state.hasLatestSnapshot).toBe(true);
      expect(state.latestSnapshot).toEqual({
        id: 'inspect-seed',
        schemaVersion: seeded.schemaVersion,
        createdAt: '2026-05-10T10:00:00.000Z',
        label: 'inspect-test',
      });

      const reopened = createSqliteRepository({ filename: temp.dbFile });
      reopened.close();
    } finally {
      temp.cleanup();
    }
  });

  it('returns stable errors for corrupt snapshot JSON and schema mismatch', () => {
    const corrupt = makeTempInspectDb();
    const mismatch = makeTempInspectDb();
    try {
      const corruptDb = createSqliteRepository({ filename: corrupt.dbFile });
      corruptDb.database
        .prepare('INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)')
        .run('corrupt', 1, '{not-json', '2026-05-10T10:00:00.000Z', null);
      corruptDb.close();

      const corruptState = inspectDevDbState({ dbFile: corrupt.dbFile });
      expect(corruptState.error).toMatchObject({ code: 'snapshot_json_invalid', message: expect.any(String) });
      expect(JSON.stringify(corruptState.error)).not.toContain('stack');

      const mismatchDb = createSqliteRepository({ filename: mismatch.dbFile });
      mismatchDb.database
        .prepare('INSERT OR REPLACE INTO app_meta(key, value) VALUES (?, ?)')
        .run('repository_schema_version', '999');
      mismatchDb.close();

      const mismatchState = inspectDevDbState({ dbFile: mismatch.dbFile });
      expect(mismatchState.error).toMatchObject({ code: 'repository_schema_mismatch', message: expect.any(String) });
      expect(JSON.stringify(mismatchState.error)).not.toContain('SqliteRepositoryError');
    } finally {
      corrupt.cleanup();
      mismatch.cleanup();
    }
  });
});
