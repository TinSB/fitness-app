import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDevDbArtifacts, DevDbRecoveryError } from '../apps/api/src/node';
import { makeTempRunnerDb } from './devApiRunnerTestHelpers';

describe('dev DB recovery artifact resolution', () => {
  it('returns normalized sqlite artifact paths without creating files', () => {
    const temp = makeTempRunnerDb();
    try {
      const artifacts = resolveDevDbArtifacts({ dbFile: temp.dbFile });

      expect(artifacts.main).toMatch(/runner\.sqlite$/);
      expect(artifacts.wal).toBe(`${artifacts.main}-wal`);
      expect(artifacts.shm).toBe(`${artifacts.main}-shm`);
      expect(artifacts.journal).toBe(`${artifacts.main}-journal`);
      expect(existsSync(temp.dbFile)).toBe(false);
      expect(existsSync(`${temp.dbFile}-wal`)).toBe(false);
      expect(JSON.stringify(artifacts)).not.toContain('.ironpath/dev-api-runner');
      expect(JSON.stringify(artifacts)).not.toContain('unrelated');
    } finally {
      temp.cleanup();
    }
  });

  it('requires the main DB filename to end with .sqlite', () => {
    const temp = makeTempRunnerDb();
    try {
      ['runner.db', 'runner.json', 'dev-api.sqlite.backup', 'source.ts'].forEach((name) => {
        expect(() => resolveDevDbArtifacts({ dbFile: join(temp.dir, name) })).toThrow(DevDbRecoveryError);
      });
    } finally {
      temp.cleanup();
    }
  });

  it('does not include runner output or unrelated sibling files', () => {
    const temp = makeTempRunnerDb();
    try {
      writeFileSync(join(temp.dir, 'runner.sqlite'), 'db', 'utf8');
      writeFileSync(join(temp.dir, 'unrelated.json'), '{}', 'utf8');
      const artifacts = resolveDevDbArtifacts({ dbFile: join(temp.dir, 'runner.sqlite') });

      expect(Object.values(artifacts)).toEqual([
        join(temp.dir, 'runner.sqlite'),
        join(temp.dir, 'runner.sqlite-wal'),
        join(temp.dir, 'runner.sqlite-shm'),
        join(temp.dir, 'runner.sqlite-journal'),
      ]);
    } finally {
      temp.cleanup();
    }
  });
});
