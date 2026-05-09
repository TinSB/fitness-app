import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import { makeAppData } from './fixtures';

describe('SQLite repository file-backed behavior', () => {
  it('persists snapshots after close and reopen without polluting the project directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ironpath-sqlite-repo-'));
    const filename = join(tempDir, 'appdata.sqlite');

    try {
      const writer = createSqliteRepository({ filename });
      writer.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
        snapshotId: 'file-first',
        createdAt: '2026-05-08T10:00:00.000Z',
      });
      writer.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
        snapshotId: 'file-second',
        createdAt: '2026-05-08T10:00:00.000Z',
      });
      writer.close();

      expect(existsSync(filename)).toBe(true);

      const reader = createSqliteRepository({ filename });
      expect(reader.readSnapshot('file-first').selectedTemplateId).toBe('push-a');
      expect(reader.readSnapshot().selectedTemplateId).toBe('pull-a');
      reader.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
