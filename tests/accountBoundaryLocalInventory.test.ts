import { describe, expect, it } from 'vitest';
import {
  buildAccountBoundaryLocalInventory,
  buildAppDataSnapshotHash,
} from '../src/cloudProduction/accountBoundaryLocalInventory';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';

const nowIso = '2026-05-24T12:00:00.000Z';

const validData = () => emptyData();

const validInput = () => {
  const appData = validData();
  return {
    appData,
    backupJson: exportAppData(appData),
    cloudAccountId: 'acct-synthetic-1',
    ownerUserId: 'acct-synthetic-1',
    deviceId: 'device-synthetic-1',
    nowIso,
  };
};

describe('account boundary local inventory', () => {
  it('builds a ready local inventory without changing local or cloud data', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildAccountBoundaryLocalInventory(input);

    expect(result).toMatchObject({
      ok: true,
      status: 'ready_for_migration_dry_run',
      productScope: 'single-user-multi-device',
      sourceOfTruth: 'localStorage',
      createdAt: nowIso,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      syncRuntimeEnabled: false,
      offlineTrainingAvailable: true,
      localStorageEmergencyFallbackPreserved: true,
      backup: {
        status: 'valid',
        exportRequiredBeforeFirstSync: true,
        localDataChanged: false,
      },
      gates: {
        canStartMigrationDryRun: true,
        canReadMirrorCandidate: false,
        canWriteShadowCandidate: false,
        canOptInSync: false,
      },
    });
    expect(result.blockingErrors).toEqual([]);
    expect(result.localOwner).toMatchObject({
      scope: 'device-local',
      deviceId: 'device-synthetic-1',
    });
    expect(result.accountCandidate).toMatchObject({
      scope: 'cloud-account-candidate',
      accountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-1',
      rlsOwnerMatch: true,
    });
    expect(result.appDataSummary.sourceSnapshotHash).toBe(buildAppDataSnapshotHash(input.appData));
    expect(input.appData).toEqual(before);
  });

  it('keeps first sync blocked when backup/export preflight is missing', () => {
    const result = buildAccountBoundaryLocalInventory({
      ...validInput(),
      backupJson: null,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'backup_required',
      backup: {
        status: 'missing',
        exportRequiredBeforeFirstSync: true,
      },
      gates: {
        canStartMigrationDryRun: false,
        canOptInSync: false,
      },
      offlineTrainingAvailable: true,
      localStorageEmergencyFallbackPreserved: true,
    });
    expect(result.blockingErrors).toContain('backup_missing');
  });

  it('blocks invalid or mismatched backup preflight without fake success', () => {
    expect(buildAccountBoundaryLocalInventory({
      ...validInput(),
      backupJson: '{not-json',
    })).toMatchObject({
      ok: false,
      status: 'backup_invalid',
      backup: { status: 'invalid' },
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });

    const staleBackupData = validData();
    staleBackupData.bodyWeights = [{ date: '2026-05-20', value: 80 }];

    const result = buildAccountBoundaryLocalInventory({
      ...validInput(),
      backupJson: exportAppData(staleBackupData),
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'backup_mismatch',
      backup: { status: 'mismatch' },
    });
    expect(result.blockingErrors).toContain('backup_mismatch');
  });

  it('fails closed when the account candidate is incomplete or owner ids do not match', () => {
    expect(buildAccountBoundaryLocalInventory({
      ...validInput(),
      cloudAccountId: undefined,
    })).toMatchObject({
      ok: false,
      status: 'account_candidate_incomplete',
      accountCandidate: null,
      gates: { canStartMigrationDryRun: false },
    });

    const mismatch = buildAccountBoundaryLocalInventory({
      ...validInput(),
      cloudAccountId: 'acct-synthetic-1',
      ownerUserId: 'owner-synthetic-2',
    });

    expect(mismatch).toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      accountCandidate: {
        accountId: 'acct-synthetic-1',
        ownerUserId: 'owner-synthetic-2',
        rlsOwnerMatch: false,
      },
    });
    expect(mismatch.blockingErrors).toContain('owner_mismatch');
  });

  it('reports missing or invalid local AppData before migration can start', () => {
    expect(buildAccountBoundaryLocalInventory({
      backupJson: null,
      cloudAccountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-1',
      nowIso,
    })).toMatchObject({
      ok: false,
      status: 'missing_local_data',
      appDataSummary: null,
      gates: { canStartMigrationDryRun: false },
    });

    const invalidData = { schemaVersion: 1 };
    const result = buildAccountBoundaryLocalInventory({
      appData: invalidData,
      backupJson: JSON.stringify(invalidData),
      cloudAccountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-1',
      nowIso,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'local_schema_invalid',
      appDataSummary: null,
      backup: { status: 'invalid' },
    });
    expect(result.blockingErrors).toContain('local_schema_invalid');
  });

  it('keeps cloud runtime and opt-in sync disabled in 19B', () => {
    const result = buildAccountBoundaryLocalInventory(validInput());

    expect(result.gates).toMatchObject({
      canReadMirrorCandidate: false,
      canWriteShadowCandidate: false,
      canOptInSync: false,
    });
    expect(result.syncRuntimeEnabled).toBe(false);
    expect(result.localDataChanged).toBe(false);
    expect(result.cloudDataChanged).toBe(false);
    expect(result.sourceOfTruthChanged).toBe(false);
  });

  it('creates deterministic hashes and timestamps from the same inputs', () => {
    const input = validInput();
    const first = buildAccountBoundaryLocalInventory(input);
    const second = buildAccountBoundaryLocalInventory(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(first.appDataSummary?.sourceSnapshotHash).toBe(second.appDataSummary?.sourceSnapshotHash);

    const changed = validData();
    changed.bodyWeights = [{ date: '2026-05-20', value: 80 }];
    expect(buildAppDataSnapshotHash(changed)).not.toBe(buildAppDataSnapshotHash(input.appData));
  });
});
