import { describe, expect, it } from 'vitest';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import type {
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import {
  runProductionFullAcceptanceSync,
  type Phase21iProductionFullAcceptanceGateway,
} from '../src/cloudProduction/productionFullAcceptanceRuntime';
import { buildAuthRuntimeWiring, createSyntheticAuthRuntimeAdapter } from '../src/cloudProduction/authRuntimeWiring';
import { buildExplicitOptInSyncPreflight } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildLocalBackupDryRunUi } from '../src/cloudProduction/localBackupDryRunUi';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import { validateAppDataSchema } from '../src/storage/appDataValidation';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T21:00:00.000Z';

const runtimeBoundaryOff = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const readiness = () => ({
  readyFor20C: true,
  missingBrowserEnvKeys: [],
  clientCreated: false,
  networkAttempted: false,
  serviceRoleExposed: false,
  secretsExposed: false,
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
  browserSafeConfigReady: true,
});

const authRuntime = () =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: readiness(),
    adapter: createSyntheticAuthRuntimeAdapter({
      userId: 'account-1',
      accountId: 'account-1',
      displayName: 'ironpath@example.test',
    }),
    action: 'sign_in',
    userInitiated: true,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso,
  });

const readyLocalDryRun = (appData: AppData) => {
  const auth = authRuntime();
  const preflight = buildExplicitOptInSyncPreflight({
    enabled: true,
    readiness: readiness(),
    authRuntime: auth,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso,
  });

  return buildLocalBackupDryRunUi({
    enabled: true,
    preflight,
    appData,
    backupJson: exportAppData(appData),
    backupExportConfirmed: true,
    dryRunRequested: true,
    schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
    runtimeBoundary: runtimeBoundaryOff,
    nowIso,
  });
};

const repositoryResult = (
  snapshot: CloudAppDataSnapshotCandidate<AppData> | null,
): CloudAppDataRepositoryCandidateResult<AppData> => snapshot
  ? {
      ok: true,
      status: 'read_candidate',
      snapshot,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: true,
      message: 'read candidate',
    }
  : {
      ok: false,
      status: 'not_found',
      errorCode: 'cloud_appdata_not_found',
      snapshot: null,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: false,
      message: 'not found',
    };

const makeMemoryGateway = (initialSnapshot: CloudAppDataSnapshotCandidate<AppData> | null = null) => {
  let snapshot = initialSnapshot;
  let readCount = 0;
  let writeCount = 0;
  const gateway: Phase21iProductionFullAcceptanceGateway<AppData> = {
    readLatestSnapshot: async () => {
      readCount += 1;
      return repositoryResult(snapshot);
    },
    writeSnapshot: async (input) => {
      writeCount += 1;
      snapshot = {
        snapshotId: 'snapshot-after-upload',
        accountId: input.owner.accountId ?? input.owner.ownerId,
        ownerUserId: input.owner.ownerId,
        owner: {
          scope: 'cloud-account-candidate',
          ownerId: input.owner.ownerId,
          accountId: input.owner.accountId,
        },
        appData: input.appData,
        schemaVersion: input.schemaVersion,
        sourceSnapshotHash: input.sourceSnapshotHash,
        operationId: input.operationId,
        validationStatus: 'valid',
        createdAt: nowIso,
      };
      return {
        ok: true,
        status: 'write_candidate',
        snapshot,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
        manualConfirmationRequired: false,
        message: 'written',
      };
    },
  };
  return {
    gateway,
    stats: () => ({ readCount, writeCount, snapshot }),
  };
};

describe('Phase 21I production full acceptance runtime', () => {
  it('runs explicit first upload and verifies cloud read parity without switching the source of truth', async () => {
    const appData = emptyData();
    const memory = makeMemoryGateway();

    const result = await runProductionFullAcceptanceSync({
      enabled: true,
      readiness: readiness(),
      authRuntime: authRuntime(),
      appData,
      localBackupDryRunUi: readyLocalDryRun(appData),
      gateway: memory.gateway,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
    });

    expect(result).toMatchObject({
      phase: '21I',
      ok: true,
      status: 'accepted',
      userMessage: '同步完成',
      firstUploadSucceeded: true,
      cloudReadMirrorMatchesLocal: true,
      cloudReadAttempted: true,
      cloudWriteAttempted: true,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageDeleted: false,
      sourceOfTruthChanged: false,
    });
    expect(result.firstUploadApply).toMatchObject({
      ok: true,
      uploadPerformed: true,
      localDataChanged: false,
      localStorageDeleted: false,
    });
    expect(result.cloudParityCheck).toMatchObject({
      ok: true,
      cloudReadAfterUploadVerified: true,
      localParityVerified: true,
      newUploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
    });
    expect(result.syncRuntime).toMatchObject({
      ok: true,
      syncRuntimeEnabled: true,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
    });
    expect(memory.stats()).toMatchObject({ readCount: 2, writeCount: 1 });
  });

  it('stops before upload when the pre-upload cloud read finds a different snapshot', async () => {
    const appData = emptyData();
    const cloudData = emptyData();
    cloudData.bodyWeights = [{ date: '2026-05-25', value: 82 }];
    const cloudSnapshot: CloudAppDataSnapshotCandidate<AppData> = {
      snapshotId: 'existing-cloud-snapshot',
      accountId: 'account-1',
      ownerUserId: 'account-1',
      owner: {
        scope: 'cloud-account-candidate',
        ownerId: 'account-1',
        accountId: 'account-1',
      },
      appData: cloudData,
      schemaVersion: String(cloudData.schemaVersion),
      sourceSnapshotHash: buildAppDataSnapshotHash(cloudData),
      operationId: 'existing-cloud-operation',
      validationStatus: 'valid',
      createdAt: '2026-05-25T20:00:00.000Z',
    };
    const memory = makeMemoryGateway(cloudSnapshot);

    const result = await runProductionFullAcceptanceSync({
      enabled: true,
      readiness: readiness(),
      authRuntime: authRuntime(),
      appData,
      localBackupDryRunUi: readyLocalDryRun(appData),
      gateway: memory.gateway,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'conflict_review_required',
      userMessage: '发现冲突',
      firstUploadSucceeded: false,
      cloudWriteAttempted: false,
      cloudPrimaryEnabled: false,
      localStorageDeleted: false,
    });
    expect(result.readMirrorVerification).toMatchObject({
      manualReviewRequired: true,
      uploadPerformed: false,
      autoApplied: false,
    });
    expect(memory.stats()).toMatchObject({ readCount: 1, writeCount: 0 });
  });

  it('honors overrideExistingCloudSnapshot=true to overwrite a stale cloud row, lands status=accepted, and produces a fresh receipt hash that the panel can persist', async () => {
    // Scenario: a real iPhone PWA has just been opened and the user (Supabase
    // userId fingerprint 6b8b4e13 in V2's readback) is staring at the
    // "云端有不同数据" banner V3 introduces. The cloud row was written
    // either by an earlier hash-algorithm version (#372 changed the
    // serializer) or by a prior test session, so source_snapshot_hash on
    // the row does not match the live local hash. The first click already
    // surfaced conflict_review_required; this test locks the second-click
    // behavior so V3's separated override button can rely on receipt
    // persistence in the .then handler of CloudSyncPolishSettingsPanel.
    const appData = emptyData();
    const staleCloudData = emptyData();
    staleCloudData.bodyWeights = [{ date: '2026-05-25', value: 82 }];
    const staleCloudSnapshot: CloudAppDataSnapshotCandidate<AppData> = {
      snapshotId: 'stale-cloud-snapshot',
      accountId: 'account-1',
      ownerUserId: 'account-1',
      owner: {
        scope: 'cloud-account-candidate',
        ownerId: 'account-1',
        accountId: 'account-1',
      },
      appData: staleCloudData,
      schemaVersion: String(staleCloudData.schemaVersion),
      sourceSnapshotHash: buildAppDataSnapshotHash(staleCloudData),
      operationId: 'stale-cloud-operation',
      validationStatus: 'valid',
      createdAt: '2026-05-25T20:00:00.000Z',
    };
    const memory = makeMemoryGateway(staleCloudSnapshot);

    const result = await runProductionFullAcceptanceSync({
      enabled: true,
      readiness: readiness(),
      authRuntime: authRuntime(),
      appData,
      localBackupDryRunUi: readyLocalDryRun(appData),
      gateway: memory.gateway,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
      overrideExistingCloudSnapshot: true,
    });

    expect(result).toMatchObject({
      phase: '21I',
      ok: true,
      status: 'accepted',
      userMessage: '同步完成',
      firstUploadSucceeded: true,
      cloudReadAttempted: true,
      cloudWriteAttempted: true,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageDeleted: false,
      sourceOfTruthChanged: false,
    });
    // The panel only writes the receipt when ok=true && status='accepted'
    // (CloudSyncPolishSettingsPanel.tsx line ~699). The override path must
    // therefore arrive at this exact tuple; the run also has to produce
    // a fresh snapshot hash so the rehydrate-on-next-mount path keys off
    // the post-override local AppData.
    expect(result.ok).toBe(true);
    expect(result.status).toBe('accepted');
    const stats = memory.stats();
    expect(stats.writeCount).toBe(1);
    expect(stats.snapshot?.sourceSnapshotHash).toBe(buildAppDataSnapshotHash(appData));
    expect(stats.snapshot?.sourceSnapshotHash).not.toBe(staleCloudSnapshot.sourceSnapshotHash);
  });

  it('still refuses to override a hard read-mirror blocker even when overrideExistingCloudSnapshot=true', async () => {
    // Hard blockers (owner_mismatch, schema_mismatch, cloud_data_invalid)
    // must never be bypassable from the panel — only the soft
    // cloud_read_manual_review blocker is. Surface a cloud row whose
    // ownerUserId does not match the signed-in user; the runtime should
    // hold the conflict and refuse to write.
    const appData = emptyData();
    const hostileCloudData = emptyData();
    const hostileCloudSnapshot: CloudAppDataSnapshotCandidate<AppData> = {
      snapshotId: 'hostile-cloud-snapshot',
      accountId: 'someone-else',
      ownerUserId: 'someone-else',
      owner: {
        scope: 'cloud-account-candidate',
        ownerId: 'someone-else',
        accountId: 'someone-else',
      },
      appData: hostileCloudData,
      schemaVersion: String(hostileCloudData.schemaVersion),
      sourceSnapshotHash: buildAppDataSnapshotHash(hostileCloudData),
      operationId: 'hostile-cloud-operation',
      validationStatus: 'valid',
      createdAt: '2026-05-25T20:00:00.000Z',
    };
    const memory = makeMemoryGateway(hostileCloudSnapshot);

    const result = await runProductionFullAcceptanceSync({
      enabled: true,
      readiness: readiness(),
      authRuntime: authRuntime(),
      appData,
      localBackupDryRunUi: readyLocalDryRun(appData),
      gateway: memory.gateway,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
      overrideExistingCloudSnapshot: true,
    });

    expect(result.ok).toBe(false);
    expect(memory.stats().writeCount).toBe(0);
  });

  it('falls back to local mode when the explicit cloud write fails', async () => {
    const appData = emptyData();
    let writeCount = 0;
    const gateway: Phase21iProductionFullAcceptanceGateway<AppData> = {
      readLatestSnapshot: async () => repositoryResult(null),
      writeSnapshot: async () => {
        writeCount += 1;
        return {
          ok: false,
          status: 'failed',
          errorCode: 'cloud_write_failed',
          snapshot: null,
          localStorageUnchanged: true,
          sourceOfTruthChanged: false,
          manualConfirmationRequired: false,
          message: 'failed',
        };
      },
    };

    const result = await runProductionFullAcceptanceSync({
      enabled: true,
      readiness: readiness(),
      authRuntime: authRuntime(),
      appData,
      localBackupDryRunUi: readyLocalDryRun(appData),
      gateway,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'upload_failed',
      userMessage: '恢复本地模式',
      firstUploadSucceeded: false,
      syncRuntime: null,
      localStorageFallbackPreserved: true,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageDeleted: false,
    });
    expect(result.firstUploadApply).toMatchObject({
      ok: false,
      status: 'upload_rejected',
      cloudWriteAttempted: true,
      uploadPerformed: false,
      localDataChanged: false,
    });
    expect(writeCount).toBe(1);
  });
});
