import { describe, expect, it } from 'vitest';
import {
  buildFirstUploadExplicitApply,
  PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID,
  type Phase21eFirstUploadExplicitApplyInput,
} from '../src/cloudProduction/firstUploadExplicitApply';
import { buildCloudReadMirrorVerification } from '../src/cloudProduction/cloudReadMirrorVerification';
import { buildCloudWriteShadowCandidate } from '../src/cloudProduction/cloudWriteShadowCandidate';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildLocalBackupDryRunUi } from '../src/cloudProduction/localBackupDryRunUi';
import type {
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
  WriteCloudAppDataCandidateInput,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import type { Phase19gCloudReadMirrorRepository } from '../src/cloudProduction/cloudReadMirror';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T16:00:00.000Z';

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
    operationId: 'phase21e-operation-1',
    requestFingerprint: 'phase21e-request-1',
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
  onWrite?: (input: WriteCloudAppDataCandidateInput<AppData>) => void,
) => ({
  writeCloudAppDataCandidate: (
    input: WriteCloudAppDataCandidateInput<AppData>,
  ): CloudAppDataRepositoryCandidateResult<AppData> => {
    onWrite?.(input);
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

const validInput = (
  overrides: Partial<Phase21eFirstUploadExplicitApplyInput<AppData>> = {},
): Phase21eFirstUploadExplicitApplyInput<AppData> => {
  const data = emptyData();
  const shadowCandidate = ready21c(data);
  const readMirrorVerification = buildCloudReadMirrorVerification({
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

  return {
    enabled: true,
    shadowCandidate,
    readMirrorVerification,
    appData: data,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    writeRepository: acceptedWriteRepository(),
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
    ...overrides,
  };
};

describe('Phase 21E first upload explicit apply', () => {
  it('is disabled by default and does not fake upload success', () => {
    const result = buildFirstUploadExplicitApply();

    expect(result).toMatchObject({
      baseId: PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID,
      phase: '21E',
      ok: false,
      status: 'disabled',
      readyFor21F: false,
      firstUploadExplicitlyApplied: false,
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
      blockers: expect.arrayContaining(['apply_disabled', 'phase21d_not_ready']),
    });
  });

  it('requires 21D readiness and explicit first-upload confirmations', () => {
    const notReady21d = buildFirstUploadExplicitApply(validInput({
      readMirrorVerification: {
        ...ready21d(),
        ok: false,
        readyFor21E: false,
        cloudReadMirrorVerified: false,
        manualReviewRequired: true,
      },
    }));
    const missingConfirmations = buildFirstUploadExplicitApply(validInput({
      explicitFirstUploadApply: false,
      localStorageFallbackConfirmed: false,
      noSilentOverwriteConfirmed: false,
      backupStillAvailableConfirmed: false,
    }));

    expect(notReady21d).toMatchObject({
      ok: false,
      status: 'phase21d_not_ready',
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining([
        'phase21d_not_ready',
        'read_mirror_not_verified',
        'manual_review_required',
      ]),
    });
    expect(missingConfirmations).toMatchObject({
      ok: false,
      status: 'explicit_apply_missing',
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining([
        'explicit_first_upload_apply_missing',
        'localStorage_fallback_not_confirmed',
        'no_silent_overwrite_not_confirmed',
        'backup_still_available_not_confirmed',
      ]),
    });
  });

  it('writes the first upload only through the injected repository after explicit apply', () => {
    let writeInput: WriteCloudAppDataCandidateInput<AppData> | null = null;
    const input = validInput({
      writeRepository: acceptedWriteRepository((candidate) => {
        writeInput = candidate;
      }),
    });
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildFirstUploadExplicitApply(input);

    expect(result).toMatchObject({
      id: 'phase21e-apply-1',
      ok: true,
      status: 'uploaded',
      readyFor21F: true,
      blockers: [],
      userMessage: '同步完成',
      firstUploadExplicitlyApplied: true,
      cloudWriteAttempted: true,
      uploadPerformed: true,
      cloudDataChanged: true,
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
      requiresCloudReadAfterUpload: true,
      requiresLocalParityCheck: true,
      nextPhase: '21F - Cloud Parity Check V1',
      uploadReceipt: {
        snapshotId: 'cloud-snapshot-upload-1',
        operationId: 'phase21e-operation-1',
        accountId: 'account-1',
        ownerUserId: 'account-1',
        schemaVersion: String(emptyData().schemaVersion),
        createdAt: nowIso,
      },
    });
    expect(writeInput).toMatchObject({
      manualConfirmation: true,
      operationId: 'phase21e-operation-1',
      owner: {
        scope: 'cloud-account-candidate',
        ownerId: 'account-1',
        accountId: 'account-1',
      },
    });
    expect(input.appData).toEqual(before);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'first_upload_explicit_only',
      'localStorage_remains_fallback',
      'no_download_performed',
      'no_auto_apply',
      'cloud_primary_not_enabled',
    ]));
  });

  it('does not report success when the repository rejects the upload', () => {
    const rejected = buildFirstUploadExplicitApply(validInput({
      writeRepository: {
        writeCloudAppDataCandidate: () => ({
          ok: false,
          status: 'failed',
          errorCode: 'cloud_write_failed',
          snapshot: null,
          localStorageUnchanged: true,
          sourceOfTruthChanged: false,
          manualConfirmationRequired: false,
          message: 'Rejected.',
        }),
      },
    }));

    expect(rejected).toMatchObject({
      ok: false,
      status: 'upload_rejected',
      readyFor21F: false,
      firstUploadExplicitlyApplied: false,
      cloudWriteAttempted: true,
      uploadPerformed: false,
      cloudDataChanged: false,
      syncRuntimeEnabled: false,
      blockers: expect.arrayContaining(['cloud_upload_rejected']),
      uploadReceipt: {
        snapshotId: null,
      },
    });
  });

  it('fails closed on schema and runtime boundary risks', () => {
    const schemaBlocked = buildFirstUploadExplicitApply(validInput({
      schemaValidator: () => false,
    }));
    const unsafe = buildFirstUploadExplicitApply(validInput({
      runtimeBoundary: {
        syncRuntimeEnabled: true,
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
      readyFor21F: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      blockers: expect.arrayContaining(['schema_invalid']),
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21F: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudDataChanged: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'sync_runtime_already_enabled',
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
    const input = validInput({ applyId: undefined });
    const before = JSON.parse(JSON.stringify(input));

    const first = buildFirstUploadExplicitApply(input);
    const second = buildFirstUploadExplicitApply(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
