import { describe, expect, it } from 'vitest';
import {
  buildCloudParityCheck,
  PHASE21F_CLOUD_PARITY_CHECK_ID,
  type Phase21fCloudParityCheckInput,
} from '../src/cloudProduction/cloudParityCheck';
import { buildCloudReadMirrorVerification } from '../src/cloudProduction/cloudReadMirrorVerification';
import { buildCloudWriteShadowCandidate } from '../src/cloudProduction/cloudWriteShadowCandidate';
import { buildFirstUploadExplicitApply } from '../src/cloudProduction/firstUploadExplicitApply';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildLocalBackupDryRunUi } from '../src/cloudProduction/localBackupDryRunUi';
import type {
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
  WriteCloudAppDataCandidateInput,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import type { Phase19gCloudReadMirrorRepository } from '../src/cloudProduction/cloudReadMirror';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T17:00:00.000Z';

const readyPreflight = (): Phase21aExplicitOptInSyncPreflightResult => ({
  id: 'phase21a-preflight-ready',
  baseId: 'phase21a-explicit-opt-in-sync-preflight',
  phase: '21A',
  ok: true,
  status: 'ready_for_backup_dry_run',
  readyFor21B: true,
  syncPreflightVisible: true,
  user: {
    userId: 'account-1',
    accountId: 'account-1',
    displayName: 'ironpath@example.test',
  },
  blockers: [],
  warnings: [
    'manual_opt_in_required',
    'backup_required_before_first_upload',
    'dry_run_required_before_first_upload',
    'localStorage_remains_fallback',
    'no_silent_overwrite',
    'no_default_sync',
    'no_background_sync',
    'cloud_primary_not_enabled',
  ],
  userMessage: '本地数据仍会保留',
  primaryActionLabel: '检查本地数据',
  secondaryActionLabels: ['开启前先备份', '查看将同步的内容'],
  requiresExplicitOptIn: true,
  requiresBackupBeforeFirstUpload: true,
  requiresDryRunBeforeFirstUpload: true,
  requiresManualConfirmationBeforeUpload: true,
  requiresConflictReviewBeforeApply: true,
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  uploadPerformed: false,
  downloadPerformed: false,
  autoApplied: false,
  localDataChanged: false,
  cloudDataChanged: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
  localStorageFallbackPreserved: true,
  serviceRoleExposed: false,
  secretsExposed: false,
  nextPhase: '21B - Local Backup Dry Run UI V1',
  createdAt: nowIso,
});

const ready21c = (data: AppData = emptyData()) => {
  const localBackupDryRunUi = buildLocalBackupDryRunUi({
    enabled: true,
    preflight: readyPreflight(),
    appData: data,
    backupJson: exportAppData(data),
    backupExportConfirmed: true,
    dryRunRequested: true,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

  return buildCloudWriteShadowCandidate({
    enabled: true,
    localBackupDryRunUi,
    appData: data,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    explicitShadowConfirmation: true,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
    operationId: 'phase21f-operation-1',
    requestFingerprint: 'phase21f-request-1',
  });
};

const cloudMissingRepository = (): Phase19gCloudReadMirrorRepository<AppData> => ({
  readLatestCloudAppDataCandidate: () => ({
    ok: false,
    status: 'not_found',
    errorCode: 'cloud_appdata_not_found',
    snapshot: null,
    localStorageUnchanged: true,
    sourceOfTruthChanged: false,
    manualConfirmationRequired: false,
    message: 'Cloud snapshot missing.',
  }),
});

const ready21d = (data: AppData = emptyData()) => {
  const shadowCandidate = ready21c(data);
  return buildCloudReadMirrorVerification({
    enabled: true,
    shadowCandidate,
    readRepository: cloudMissingRepository(),
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    explicitReadMirrorVerification: true,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });
};

const acceptedWriteRepository = (
  onSnapshot?: (snapshot: CloudAppDataSnapshotCandidate<AppData>) => void,
) => ({
  writeCloudAppDataCandidate: (
    input: WriteCloudAppDataCandidateInput<AppData>,
  ): CloudAppDataRepositoryCandidateResult<AppData> => {
    const snapshot: CloudAppDataSnapshotCandidate<AppData> = {
      snapshotId: 'cloud-snapshot-upload-1',
      accountId: input.owner.accountId ?? input.owner.ownerId,
      ownerUserId: input.owner.ownerId,
      owner: input.owner,
      appData: input.appData,
      schemaVersion: input.schemaVersion,
      sourceSnapshotHash: input.sourceSnapshotHash,
      operationId: input.operationId,
      validationStatus: 'valid',
      createdAt: nowIso,
    };
    onSnapshot?.(snapshot);

    return {
      ok: true,
      status: 'write_candidate',
      snapshot,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: false,
      message: 'Cloud AppData write candidate accepted.',
    };
  },
});

const ready21e = (
  data: AppData,
  onSnapshot?: (snapshot: CloudAppDataSnapshotCandidate<AppData>) => void,
) => {
  const shadowCandidate = ready21c(data);
  return buildFirstUploadExplicitApply({
    enabled: true,
    shadowCandidate,
    readMirrorVerification: ready21d(data),
    appData: data,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    writeRepository: acceptedWriteRepository(onSnapshot),
    explicitFirstUploadApply: true,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupStillAvailableConfirmed: true,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
    applyId: 'phase21e-apply-1',
  });
};

const repositoryWithSnapshot = (
  snapshot: CloudAppDataSnapshotCandidate<AppData>,
  onRead?: () => void,
): Phase19gCloudReadMirrorRepository<AppData> => ({
  readLatestCloudAppDataCandidate: () => {
    onRead?.();
    return {
      ok: true,
      status: 'read_candidate',
      snapshot,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: true,
      message: 'Cloud snapshot read after upload.',
    };
  },
});

const validInput = (
  overrides: Partial<Phase21fCloudParityCheckInput<AppData>> = {},
): Phase21fCloudParityCheckInput<AppData> => {
  const data = emptyData();
  let uploadedSnapshot: CloudAppDataSnapshotCandidate<AppData> | null = null;
  const firstUploadApply = ready21e(data, (snapshot) => {
    uploadedSnapshot = snapshot;
  });
  if (!uploadedSnapshot) throw new Error('Expected first upload snapshot.');

  return {
    enabled: true,
    firstUploadApply,
    appData: data,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    readRepository: repositoryWithSnapshot(uploadedSnapshot),
    explicitCloudReadAfterUpload: true,
    explicitLocalParityCheck: true,
    runtimeBoundary: {
      syncRuntimeEnabled: true,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
    parityCheckId: 'phase21f-parity-1',
    ...overrides,
  };
};

describe('Phase 21F cloud parity check', () => {
  it('is disabled by default and does not read write or mutate local state', () => {
    const result = buildCloudParityCheck();

    expect(result).toMatchObject({
      baseId: PHASE21F_CLOUD_PARITY_CHECK_ID,
      phase: '21F',
      ok: false,
      status: 'disabled',
      readyFor21G: false,
      readAfterUpload: null,
      cloudReadAttempted: false,
      cloudReadAfterUploadVerified: false,
      localParityVerified: false,
      uploadReceiptVerified: false,
      conflictReviewRequired: false,
      firstUploadExplicitlyApplied: false,
      firstUploadPreviouslyPerformed: false,
      newUploadPerformed: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudDataChanged: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining(['parity_disabled', 'phase21e_not_ready']),
    });
  });

  it('verifies cloud read-after-upload parity against the local snapshot and upload receipt', () => {
    let reads = 0;
    const input = validInput({
      readRepository: repositoryWithSnapshot(
        validInput().readRepository?.readLatestCloudAppDataCandidate().snapshot as CloudAppDataSnapshotCandidate<AppData>,
        () => {
          reads += 1;
        },
      ),
    });
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildCloudParityCheck(input);

    expect(reads).toBe(1);
    expect(result).toMatchObject({
      id: 'phase21f-parity-1',
      ok: true,
      status: 'parity_verified',
      readyFor21G: true,
      blockers: [],
      userMessage: '同步完成',
      cloudReadAttempted: true,
      cloudReadAfterUploadVerified: true,
      localParityVerified: true,
      uploadReceiptVerified: true,
      conflictReviewRequired: false,
      firstUploadExplicitlyApplied: true,
      firstUploadPreviouslyPerformed: true,
      newUploadPerformed: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudDataChanged: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      syncRuntimeEnabled: true,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      requiresConflictReviewBeforeApply: true,
      requiresRollbackIfParityFails: true,
      nextPhase: '21G - Conflict Review V1',
      readAfterUpload: {
        status: 'mirrored',
        requiresManualReview: false,
        applied: false,
        cloudWriteAttempted: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
      },
      parity: {
        localMatchesReceipt: true,
        cloudMetadataMatchesReceipt: true,
        cloudAppDataMatchesReceipt: true,
        snapshotIdMatchesReceipt: true,
        operationIdMatchesReceipt: true,
        ownerMatchesReceipt: true,
        schemaMatchesReceipt: true,
        createdAtMatchesReceipt: true,
      },
    });
    expect(result.parity.localSnapshotHash).toBe(buildAppDataSnapshotHash(input.appData));
    expect(input.appData).toEqual(before);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'read_after_upload_only',
      'localStorage_remains_fallback',
      'no_new_upload_performed',
      'no_download_performed',
      'no_auto_apply',
      'cloud_primary_not_enabled',
      'no_default_or_background_sync',
    ]));
  });

  it('requires 21E first upload readiness and explicit parity checks', () => {
    const notReady21e = buildCloudParityCheck(validInput({
      firstUploadApply: {
        ...ready21e(emptyData()),
        ok: false,
        readyFor21F: false,
        firstUploadExplicitlyApplied: false,
        uploadPerformed: false,
        syncRuntimeEnabled: false,
      },
    }));
    const missingConfirmations = buildCloudParityCheck(validInput({
      explicitCloudReadAfterUpload: false,
      explicitLocalParityCheck: false,
    }));

    expect(notReady21e).toMatchObject({
      ok: false,
      status: 'phase21e_not_ready',
      cloudReadAttempted: false,
      blockers: expect.arrayContaining([
        'phase21e_not_ready',
        'first_upload_not_applied',
        'sync_runtime_not_enabled_after_upload',
      ]),
    });
    expect(missingConfirmations).toMatchObject({
      ok: false,
      status: 'explicit_parity_check_missing',
      cloudReadAttempted: false,
      blockers: expect.arrayContaining([
        'explicit_cloud_read_after_upload_missing',
        'explicit_local_parity_check_missing',
      ]),
    });
  });

  it('rejects cloud missing or rejected reads after upload without fake parity success', () => {
    const cloudMissing = buildCloudParityCheck(validInput({
      readRepository: cloudMissingRepository(),
    }));
    const rejected = buildCloudParityCheck(validInput({
      readRepository: {
        readLatestCloudAppDataCandidate: () => ({
          ok: true,
          status: 'read_candidate',
          snapshot: {
            ...(validInput().readRepository?.readLatestCloudAppDataCandidate().snapshot as CloudAppDataSnapshotCandidate<AppData>),
            owner: {
              scope: 'cloud-account-candidate',
              ownerId: 'other-account',
              accountId: 'other-account',
            },
            accountId: 'other-account',
            ownerUserId: 'other-account',
          },
          localStorageUnchanged: true,
          sourceOfTruthChanged: false,
          manualConfirmationRequired: true,
          message: 'Foreign snapshot.',
        }),
      },
    }));

    expect(cloudMissing).toMatchObject({
      ok: false,
      status: 'cloud_read_rejected',
      readyFor21G: false,
      cloudReadAttempted: true,
      cloudReadAfterUploadVerified: false,
      blockers: expect.arrayContaining(['cloud_missing_after_upload']),
      readAfterUpload: {
        status: 'cloud_missing',
      },
    });
    expect(rejected).toMatchObject({
      ok: false,
      status: 'cloud_read_rejected',
      readyFor21G: false,
      cloudReadAttempted: true,
      cloudReadAfterUploadVerified: false,
      blockers: expect.arrayContaining(['cloud_read_rejected']),
      readAfterUpload: {
        status: 'rejected',
      },
    });
  });

  it('detects local or cloud parity mismatch and requires later conflict review', () => {
    const base = validInput();
    const localChanged: AppData = {
      ...(base.appData as AppData),
      trainingMode: 'strength',
    };
    const localMismatch = buildCloudParityCheck({
      ...base,
      appData: localChanged,
    });

    const baseSnapshot = base.readRepository?.readLatestCloudAppDataCandidate().snapshot as CloudAppDataSnapshotCandidate<AppData>;
    const cloudChanged: AppData = {
      ...baseSnapshot.appData,
      trainingMode: 'hypertrophy',
    };
    const cloudMismatch = buildCloudParityCheck({
      ...base,
      readRepository: repositoryWithSnapshot({
        ...baseSnapshot,
        appData: cloudChanged,
      }),
    });

    expect(localMismatch).toMatchObject({
      ok: false,
      status: 'parity_mismatch',
      readyFor21G: false,
      userMessage: '发现冲突',
      conflictReviewRequired: true,
      cloudReadAttempted: true,
      cloudReadAfterUploadVerified: false,
      localParityVerified: false,
      uploadReceiptVerified: false,
      cloudWriteAttempted: false,
      autoApplied: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
      blockers: expect.arrayContaining(['local_hash_mismatch']),
    });
    expect(cloudMismatch).toMatchObject({
      ok: false,
      status: 'parity_mismatch',
      readyFor21G: false,
      userMessage: '发现冲突',
      conflictReviewRequired: true,
      blockers: expect.arrayContaining(['cloud_appdata_hash_mismatch']),
      parity: {
        cloudMetadataMatchesReceipt: true,
        cloudAppDataMatchesReceipt: false,
      },
    });
  });

  it('fails closed on schema and runtime boundary risks', () => {
    const schemaBlocked = buildCloudParityCheck(validInput({
      schemaValidator: () => false,
    }));
    const unsafe = buildCloudParityCheck(validInput({
      runtimeBoundary: {
        syncRuntimeEnabled: false,
        liveCloudSyncActivated: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(schemaBlocked).toMatchObject({
      ok: false,
      status: 'schema_invalid',
      readyFor21G: false,
      cloudReadAttempted: false,
      blockers: expect.arrayContaining(['local_schema_invalid']),
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21G: false,
      cloudReadAttempted: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'sync_runtime_not_enabled_after_upload',
        'live_sync_already_active',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('uses deterministic ids and does not mutate inputs', () => {
    const input = validInput({ parityCheckId: undefined });
    const before = JSON.parse(JSON.stringify(input));

    const first = buildCloudParityCheck(input);
    const second = buildCloudParityCheck(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
