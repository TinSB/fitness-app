import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import { analyzeImportedAppData } from '../src/engines/dataRepairEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import { makeAppData } from './fixtures';
import { expectAppDataParity, expectSummaryOnlyRepairLogs, snapshotCount } from './sqliteRepositoryTestHelpers';

const needsReviewPayload = () =>
  JSON.stringify({
    ...makeAppData(),
    ...(unitFixture.data as object),
  });

const cleanBackupData = (overrides: Partial<ReturnType<typeof makeAppData>> = {}) => {
  const base = makeAppData(overrides);
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

describe('SQLite repository backup round-trip', () => {
  it('keeps existing backup export -> SQLite import -> SQLite export semantics', () => {
    const repo = createSqliteRepository();
    const data = cleanBackupData({ selectedTemplateId: 'legs-a' });
    const backup = exportAppData(data);
    const imported = repo.importBackupToSnapshot(backup, {
      snapshotId: 'cleaned-backup',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.message);
    const sqliteBackup = repo.exportBackupFromSnapshot(imported.snapshot.snapshotId);
    const directImport = importAppData(sqliteBackup);

    expect(directImport.ok).toBe(true);
    expect(directImport.data).toBeDefined();
    expectAppDataParity(directImport.data!, data);
    repo.close();
  });

  it('rejects unsafe backup import and leaves no snapshot', () => {
    const repo = createSqliteRepository();
    const result = repo.importBackupToSnapshot(JSON.stringify({ source: 'health-json', samples: [] }), {
      snapshotId: 'unsafe',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, status: 'unsafe' });
    expect(snapshotCount(repo.database)).toBe(0);
    repo.close();
  });

  it('imports cleaned JSON without changing backup safety', () => {
    const repo = createSqliteRepository();
    const data = cleanBackupData({ selectedTemplateId: 'pull-a' });
    const result = repo.importBackupToSnapshot(exportAppData(data), {
      snapshotId: 'cleaned',
      createdAt: '2026-05-08T10:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(snapshotCount(repo.database)).toBe(1);
    expectAppDataParity(repo.readSnapshot(), data);
    repo.close();
  });

  it('requires confirmation for needs-review import and writes repaired data only after confirmation', () => {
    const repo = createSqliteRepository();
    const payload = needsReviewPayload();
    const report = analyzeImportedAppData(JSON.parse(payload));
    expect(report.status).toBe('needs_review');

    const unconfirmed = repo.importBackupToSnapshot(payload, {
      snapshotId: 'needs-review-unconfirmed',
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    expect(unconfirmed).toMatchObject({ ok: false, status: 'needs_review' });
    expect(snapshotCount(repo.database)).toBe(0);

    const confirmed = repo.importBackupToSnapshot(payload, {
      snapshotId: 'needs-review-confirmed',
      createdAt: '2026-05-08T10:01:00.000Z',
      confirmNeedsReview: true,
      label: 'anonymous-minimal.json',
    });
    expect(confirmed.ok).toBe(true);
    expect(snapshotCount(repo.database)).toBe(1);
    expectSummaryOnlyRepairLogs(repo.readSnapshot());
    repo.close();
  });

  it('does not leave a partial snapshot when import write fails', () => {
    const repo = createSqliteRepository();
    const data = cleanBackupData({ selectedTemplateId: 'pull-a' });
    const backup = exportAppData(data);

    const first = repo.importBackupToSnapshot(backup, {
      snapshotId: 'duplicate-import',
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    const second = repo.importBackupToSnapshot(backup, {
      snapshotId: 'duplicate-import',
      createdAt: '2026-05-08T10:01:00.000Z',
    });

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, status: 'invalid' });
    expect(snapshotCount(repo.database)).toBe(1);
    repo.close();
  });
});
