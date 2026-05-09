import { describe, expect, it } from 'vitest';
import { createSqliteRepository, SqliteRepositoryError } from '../apps/api/src/node';
import type { SqliteRepositoryErrorCode } from '../apps/api/src/sqliteRepository';
import { exportAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import { appMetaValue, snapshotCount, snapshotExists } from './sqliteRepositoryTestHelpers';

const expectRepositoryError = (operation: () => unknown, code: SqliteRepositoryErrorCode) => {
  try {
    operation();
    throw new Error('Expected SqliteRepositoryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(SqliteRepositoryError);
    expect((error as SqliteRepositoryError).code).toBe(code);
  }
};

const installFailingInsertTrigger = (repo: ReturnType<typeof createSqliteRepository>, snapshotId: string) => {
  repo.database.exec(`
    CREATE TRIGGER fail_${snapshotId.replace(/[^A-Za-z0-9_]/g, '_')}_insert
    BEFORE INSERT ON app_data_snapshots
    WHEN NEW.id = '${snapshotId.replace(/'/g, "''")}'
    BEGIN
      SELECT RAISE(ABORT, 'forced snapshot insert failure');
    END;
  `);
};

const needsReviewPayload = () =>
  JSON.stringify({
    ...makeAppData(),
    ...(unitFixture.data as object),
  });

const cleanBackupData = (selectedTemplateId: string) => {
  const base = makeAppData({ selectedTemplateId });
  return sanitizeData({
    ...base,
    activeProgramTemplateId: base.programTemplate.id,
    settings: {
      ...base.settings,
      activeProgramTemplateId: base.programTemplate.id,
    },
    todayStatus: {
      ...base.todayStatus,
      date: '2026-05-08',
    },
  });
};

describe('SQLite repository transaction rollback', () => {
  it('rolls back writeSnapshot metadata and rows when insertion fails inside the transaction', () => {
    const repo = createSqliteRepository();
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'stable',
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    installFailingInsertTrigger(repo, 'trigger-fail');

    expectRepositoryError(
      () =>
        repo.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
          snapshotId: 'trigger-fail',
          createdAt: '2026-05-08T10:01:00.000Z',
        }),
      'transaction_failed',
    );

    expect(snapshotCount(repo.database)).toBe(1);
    expect(snapshotExists(repo.database, 'trigger-fail')).toBe(false);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('stable');
    expect(repo.readSnapshot().selectedTemplateId).toBe('push-a');
    repo.close();
  });

  it('rejects unsafe, malformed, and unconfirmed needs-review imports without writing snapshots', () => {
    const repo = createSqliteRepository();

    expect(repo.importBackupToSnapshot(JSON.stringify({ source: 'health-json', samples: [] }))).toMatchObject({
      ok: false,
      status: 'unsafe',
    });
    expect(repo.importBackupToSnapshot('{not-json')).toMatchObject({ ok: false, status: 'invalid' });
    expect(repo.importBackupToSnapshot(needsReviewPayload())).toMatchObject({ ok: false, status: 'needs_review' });

    expect(snapshotCount(repo.database)).toBe(0);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBeUndefined();
    repo.close();
  });

  it('rolls back importBackupToSnapshot when the snapshot write fails mid-transaction', () => {
    const repo = createSqliteRepository();
    const backup = exportAppData(cleanBackupData('pull-a'));
    repo.writeSnapshot(makeAppData({ selectedTemplateId: 'push-a' }), {
      snapshotId: 'stable-import',
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    installFailingInsertTrigger(repo, 'import-trigger-fail');

    const result = repo.importBackupToSnapshot(backup, {
      snapshotId: 'import-trigger-fail',
      createdAt: '2026-05-08T10:01:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, status: 'invalid' });
    expect(snapshotCount(repo.database)).toBe(1);
    expect(snapshotExists(repo.database, 'import-trigger-fail')).toBe(false);
    expect(appMetaValue(repo.database, 'latest_snapshot_id')).toBe('stable-import');
    expect(repo.readSnapshot().selectedTemplateId).toBe('push-a');
    repo.close();
  });
});
