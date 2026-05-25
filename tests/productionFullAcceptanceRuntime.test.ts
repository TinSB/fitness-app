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
