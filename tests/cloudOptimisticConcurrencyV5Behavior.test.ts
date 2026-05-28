import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import {
  CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES,
  runCloudSubsequentUpload,
  type CloudSubsequentUploadGateway,
  type CloudSubsequentUploadLocalSyncState,
} from '../src/cloudProduction/cloudSubsequentUploadFlow';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { runAutoRepairOrchestrator } from '../src/dataHealth/autoRepairOrchestrator';
import {
  type AutoRepairBackupAdapter,
  type AutoRepairBackupRecord,
} from '../src/dataHealth/autoRepairBackupAdapter';

const FIXTURE_PATH = resolve(
  __dirname,
  './fixtures/data-health/ironpath-2026-05-27-redacted.json',
);
const loadFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const FIXED_NOW = () => new Date('2026-05-29T00:00:00Z');

const memoryAdapter = (): AutoRepairBackupAdapter & { failNext: boolean } => {
  const adapter: AutoRepairBackupAdapter & { failNext: boolean } = {
    failNext: false,
    snapshot: async (params): Promise<AutoRepairBackupRecord> => {
      if (adapter.failNext) {
        throw new Error('backup failure');
      }
      return {
        id: `mem-${Date.now()}`,
        createdAt: new Date().toISOString(),
        triggeredBy: params.triggeredBy,
        appDataHashBefore: params.appDataHashBefore,
        repairIdScope: [...params.repairIdScope],
        payloadSize: 0,
        storage: 'memory',
      };
    },
    list: async () => [],
  };
  return adapter;
};

type ReadParams = Parameters<
  NonNullable<CloudSubsequentUploadGateway['readLatestSnapshot']>
>[0];
type ReadResult = Awaited<
  ReturnType<NonNullable<CloudSubsequentUploadGateway['readLatestSnapshot']>>
>;
type WriteParams = Parameters<CloudSubsequentUploadGateway['writeSnapshot']>[0];

interface ConcurrencyFakeGateway extends CloudSubsequentUploadGateway {
  readCalls: ReadParams[];
  writeCalls: WriteParams[];
  readReturn: ReadResult;
  readThrows: boolean;
  writeFails: boolean;
}

const concurrencyGateway = (overrides?: Partial<ReadResult>): ConcurrencyFakeGateway => {
  const gateway: ConcurrencyFakeGateway = {
    readCalls: [],
    writeCalls: [],
    readThrows: false,
    writeFails: false,
    readReturn: {
      ok: true,
      sourceSnapshotHash: null,
      createdAt: '2026-05-28T12:00:00Z',
      ...overrides,
    },
    readLatestSnapshot: async (params) => {
      gateway.readCalls.push(params);
      if (gateway.readThrows) throw new Error('cloud unreachable');
      return gateway.readReturn;
    },
    writeSnapshot: async (params) => {
      gateway.writeCalls.push(params);
      if (gateway.writeFails) {
        return { ok: false, error: 'rejected_by_server' };
      }
      return {
        ok: true,
        snapshotId: `cloud-${gateway.writeCalls.length}`,
        sourceSnapshotHash: params.nextSnapshotHash,
        createdAt: params.nowIso,
      };
    },
  };
  return gateway;
};

const repairedFixture = async (): Promise<AppData> => {
  const data = loadFixture();
  const adapter = memoryAdapter();
  const repaired = await runAutoRepairOrchestrator({
    appData: data,
    triggeredBy: 'boot',
    backupAdapter: adapter,
    now: FIXED_NOW,
  });
  expect(repaired.changed).toBe(true);
  return repaired.appData;
};

const localStateOf = (
  appData: AppData,
  ownerUserId = 'owner-A',
): CloudSubsequentUploadLocalSyncState => ({
  syncedAppDataHash: buildAppDataSnapshotHash(appData),
  syncedOwnerUserId: ownerUserId,
  syncedAt: '2026-05-28T00:00:00Z',
});

describe('cloudOptimisticConcurrencyV5Behavior', () => {
  it('cloudOptimisticConcurrencyV5ReasonsExportIncludesNewMembers', () => {
    expect(CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES).toContain('remote_changed');
    expect(CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES).toContain('remote_unavailable');
    expect(CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES).toContain(
      'missing_expected_previous_snapshot',
    );
  });

  // 1. expected hash matches remote latest -> upload proceeds.
  it('cloudOptimisticConcurrencyV5ExpectedMatchesRemoteUploads', async () => {
    const appData = await repairedFixture();
    const previousHash = 'previous-snapshot-hash';
    const gateway = concurrencyGateway({ sourceSnapshotHash: previousHash });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      accountId: 'account-A',
      localSyncState: { syncedAppDataHash: previousHash, syncedOwnerUserId: 'owner-A' },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.uploaded).toBe(true);
    expect(result.reason).toBe('uploaded');
    expect(gateway.readCalls.length).toBe(1);
    expect(gateway.readCalls[0].accountId).toBe('account-A');
    expect(gateway.readCalls[0].ownerUserId).toBe('owner-A');
    expect(gateway.writeCalls.length).toBe(1);
    expect(gateway.writeCalls[0].expectedPreviousHash).toBe(previousHash);
    expect(gateway.writeCalls[0].nextSnapshotHash).toBe(result.snapshotHash);
  });

  // 2. expected hash mismatches remote latest -> no upload, reason 'remote_changed'.
  it('cloudOptimisticConcurrencyV5RemoteChangedBlocksUpload', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({
      sourceSnapshotHash: 'remote-moved-on-hash',
    });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      accountId: 'account-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('remote_changed');
    expect(result.uploaded).toBe(false);
    expect(gateway.readCalls.length).toBe(1);
    expect(gateway.writeCalls.length).toBe(0);
    expect(result.passiveStatus.line).toBe('云端有更新，请稍后同步');
    expect(result.hiddenDebugDetails?.observedCloudLatestHash).toBe(
      'remote-moved-on-hash',
    );
    expect(result.hiddenDebugDetails?.expectedPreviousHash).toBe(
      'previous-snapshot-hash',
    );
  });

  // 3. remote latest unavailable (read throws) -> reason 'remote_unavailable'.
  it('cloudOptimisticConcurrencyV5ReadThrowsBlocksUploadAsRemoteUnavailable', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway();
    gateway.readThrows = true;
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('remote_unavailable');
    expect(gateway.writeCalls.length).toBe(0);
    expect(result.hiddenDebugDetails?.readLatestException).toBeDefined();
  });

  // 3b. remote latest unavailable (read returns ok:false) -> reason 'remote_unavailable'.
  it('cloudOptimisticConcurrencyV5ReadOkFalseBlocksUploadAsRemoteUnavailable', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway();
    gateway.readReturn = { ok: false, error: 'auth_required' };
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('remote_unavailable');
    expect(gateway.writeCalls.length).toBe(0);
    expect(result.hiddenDebugDetails?.readLatestError).toBe('auth_required');
  });

  // 4. unchanged local hash and remote unchanged -> unchanged, no upload.
  it('cloudOptimisticConcurrencyV5UnchangedLocalAndRemoteSkipsUpload', async () => {
    const appData = await repairedFixture();
    const syncedHash = buildAppDataSnapshotHash(appData);
    const gateway = concurrencyGateway({ sourceSnapshotHash: syncedHash });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: localStateOf(appData),
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('unchanged');
    expect(result.uploaded).toBe(false);
    expect(gateway.readCalls.length).toBe(1);
    expect(gateway.writeCalls.length).toBe(0);
  });

  // 5. unchanged local hash but remote changed -> remote_changed (not unchanged).
  it('cloudOptimisticConcurrencyV5UnchangedLocalButRemoteChangedSurfacesConflict', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({
      sourceSnapshotHash: 'remote-moved-on-without-our-knowledge',
    });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: localStateOf(appData),
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('remote_changed');
    expect(result.uploaded).toBe(false);
    expect(gateway.readCalls.length).toBe(1);
    expect(gateway.writeCalls.length).toBe(0);
  });

  // 6. eligibility guard fails -> no remote latest write (writeSnapshot never called).
  it('cloudOptimisticConcurrencyV5EligibilityFailureDoesNotWrite', async () => {
    const appData = loadFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: 'previous-snapshot-hash' });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(['pending_safe_repairs', 'partially_repaired', 'missing_repair_receipt']).toContain(
      result.reason,
    );
    expect(gateway.writeCalls.length).toBe(0);
  });

  // 7. pending repair -> no upload.
  it('cloudOptimisticConcurrencyV5PendingRepairBlocksUpload', async () => {
    const appData = loadFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: 'previous-snapshot-hash' });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(gateway.writeCalls.length).toBe(0);
    expect(result.passiveStatus.tone === 'busy' || result.passiveStatus.tone === 'audit-pending').toBe(
      true,
    );
  });

  // 8. repaired snapshot with receipt + expected remote hash -> upload.
  it('cloudOptimisticConcurrencyV5RepairedSnapshotWithReceiptUploads', async () => {
    const appData = await repairedFixture();
    const previousHash = 'previous-snapshot-hash';
    const gateway = concurrencyGateway({ sourceSnapshotHash: previousHash });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      accountId: 'account-A',
      localSyncState: { syncedAppDataHash: previousHash, syncedOwnerUserId: 'owner-A' },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.uploaded).toBe(true);
    expect(result.reason).toBe('uploaded');
    expect(result.repairReceiptSummary?.ledgerHashMatches).toBe(true);
    expect(gateway.writeCalls.length).toBe(1);
    expect(gateway.writeCalls[0].expectedPreviousHash).toBe(previousHash);
  });

  // 9. upload failure does not mark synced (result.ok=false, uploaded=false,
  //    reason='upload_failed', so callers do NOT update syncedAppDataHash).
  it('cloudOptimisticConcurrencyV5UploadFailureDoesNotMarkSynced', async () => {
    const appData = await repairedFixture();
    const previousHash = 'previous-snapshot-hash';
    const gateway = concurrencyGateway({ sourceSnapshotHash: previousHash });
    gateway.writeFails = true;
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: { syncedAppDataHash: previousHash, syncedOwnerUserId: 'owner-A' },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.uploaded).toBe(false);
    expect(result.reason).toBe('upload_failed');
    expect(result.hiddenDebugDetails?.gatewayError).toBe('rejected_by_server');
    expect(gateway.writeCalls.length).toBe(1);
  });

  // 10. successful upload returns a stable snapshotHash callers can persist.
  it('cloudOptimisticConcurrencyV5SuccessfulUploadReturnsStableSnapshotHash', async () => {
    const appData = await repairedFixture();
    const previousHash = 'previous-snapshot-hash';
    const gateway = concurrencyGateway({ sourceSnapshotHash: previousHash });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: { syncedAppDataHash: previousHash, syncedOwnerUserId: 'owner-A' },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.snapshotHash).toBe(buildAppDataSnapshotHash(appData));
    // The callers are expected to persist `result.snapshotHash` to the
    // synced-hash receipt only when result.ok && result.uploaded.
    expect(result.snapshotHash).toBe(gateway.writeCalls[0].nextSnapshotHash);
  });

  // 11. conflict does not clear localStorage (the flow never imports it; static
  //     tests forbid clear/removeItem). Re-asserted at behavior level by
  //     confirming the flow returns without throwing and does not surface a
  //     destructive intent flag.
  it('cloudOptimisticConcurrencyV5RemoteChangedDoesNotProduceDestructiveIntent', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: 'remote-moved-on' });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: localStateOf(appData),
      gateway,
      now: FIXED_NOW,
    });
    expect(result.reason).toBe('remote_changed');
    expect(result.uploaded).toBe(false);
    // The result shape must not carry any "wipe local" / "delete cloud" flag.
    // Defensive: stringify and ensure no destructive marker leaked.
    const serialized = JSON.stringify(result);
    expect(serialized.includes('"localStorageDeleted":true')).toBe(false);
    expect(serialized.includes('"clearLocal":true')).toBe(false);
    expect(serialized.includes('"deleteCloud":true')).toBe(false);
  });

  // 12. conflict does not call writeSnapshot (cloud row not touched).
  it('cloudOptimisticConcurrencyV5RemoteChangedDoesNotInvokeWriteSnapshot', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: 'remote-moved-on' });
    await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: localStateOf(appData),
      gateway,
      now: FIXED_NOW,
    });
    expect(gateway.writeCalls.length).toBe(0);
  });

  // 13. account switch does not reuse previous account expected hash.
  it('cloudOptimisticConcurrencyV5AccountSwitchInvalidatesReceiptBeforeFreshRead', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: 'previous-snapshot-hash' });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-B',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_enabled');
    // Owner mismatch short-circuits BEFORE the fresh read so a foreign-owner
    // attempt can never even probe another account's cloud latest.
    expect(gateway.readCalls.length).toBe(0);
    expect(gateway.writeCalls.length).toBe(0);
  });

  // Bonus: V4 backward compatibility — gateway without readLatestSnapshot
  // skips the V5 preflight, preserving the V4 short-circuit semantics.
  it('cloudOptimisticConcurrencyV5LegacyGatewayWithoutReadLatestSkipsFreshRead', async () => {
    const appData = await repairedFixture();
    const previousHash = 'previous-snapshot-hash';
    // Build a gateway with only writeSnapshot (no readLatestSnapshot).
    const writeCalls: WriteParams[] = [];
    const legacyGateway: CloudSubsequentUploadGateway = {
      writeSnapshot: async (params) => {
        writeCalls.push(params);
        return {
          ok: true,
          snapshotId: 'cloud-1',
          sourceSnapshotHash: params.nextSnapshotHash,
          createdAt: params.nowIso,
        };
      },
    };
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: { syncedAppDataHash: previousHash, syncedOwnerUserId: 'owner-A' },
      gateway: legacyGateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('uploaded');
    expect(writeCalls.length).toBe(1);
  });

  // Bonus: when the fresh read returns ok:true but with `sourceSnapshotHash`
  // missing (e.g. no rows yet for this owner), V5 treats it as remote_changed
  // — the local synced hash claims to have a baseline that the cloud does
  // not actually contain.
  it('cloudOptimisticConcurrencyV5RemoteWithoutBaselineSurfacesRemoteChanged', async () => {
    const appData = await repairedFixture();
    const gateway = concurrencyGateway({ sourceSnapshotHash: null });
    const result = await runCloudSubsequentUpload({
      appData,
      ownerUserId: 'owner-A',
      localSyncState: {
        syncedAppDataHash: 'previous-snapshot-hash',
        syncedOwnerUserId: 'owner-A',
      },
      gateway,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('remote_changed');
    expect(result.hiddenDebugDetails?.observedCloudLatestHash).toBeNull();
  });
});
