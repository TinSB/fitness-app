import { describe, expect, it } from 'vitest';
import {
  buildCloudReadMirrorVerification,
  PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID,
  type Phase21dCloudReadMirrorVerificationInput,
} from '../src/cloudProduction/cloudReadMirrorVerification';
import { buildCloudWriteShadowCandidate } from '../src/cloudProduction/cloudWriteShadowCandidate';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildLocalBackupDryRunUi } from '../src/cloudProduction/localBackupDryRunUi';
import type {
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import type { Phase19gCloudReadMirrorRepository } from '../src/cloudProduction/cloudReadMirror';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T15:00:00.000Z';

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
    operationId: 'phase21c-operation-1',
    requestFingerprint: 'phase21c-request-1',
  });
};

const repositoryResult = (
  result: CloudAppDataRepositoryCandidateResult<AppData>,
): Phase19gCloudReadMirrorRepository<AppData> => ({
  readLatestCloudAppDataCandidate: () => result,
});

const cloudMissingRepository = (): Phase19gCloudReadMirrorRepository<AppData> =>
  repositoryResult({
    ok: false,
    status: 'not_found',
    errorCode: 'cloud_appdata_not_found',
    snapshot: null,
    localStorageUnchanged: true,
    sourceOfTruthChanged: false,
    manualConfirmationRequired: false,
    message: 'Cloud snapshot missing.',
  });

const cloudSnapshot = (
  data: AppData,
  shadowCandidate = ready21c(data),
  overrides: Partial<CloudAppDataSnapshotCandidate<AppData>> = {},
): CloudAppDataSnapshotCandidate<AppData> => ({
  snapshotId: 'cloud-snapshot-1',
  accountId: 'account-1',
  ownerUserId: 'account-1',
  owner: {
    scope: 'cloud-account-candidate',
    ownerId: 'account-1',
    accountId: 'account-1',
  },
  appData: data,
  schemaVersion: String(data.schemaVersion),
  sourceSnapshotHash: shadowCandidate.shadowCandidate.sourceSnapshotHash as string,
  operationId: 'phase21d-read-1',
  validationStatus: 'valid',
  createdAt: shadowCandidate.shadowCandidate.createdAt,
  ...overrides,
});

const repositoryWithSnapshot = (
  snapshot: CloudAppDataSnapshotCandidate<AppData>,
): Phase19gCloudReadMirrorRepository<AppData> =>
  repositoryResult({
    ok: true,
    status: 'read_candidate',
    snapshot,
    localStorageUnchanged: true,
    sourceOfTruthChanged: false,
    manualConfirmationRequired: true,
    message: 'Cloud snapshot read candidate.',
  });

const validInput = (
  overrides: Partial<Phase21dCloudReadMirrorVerificationInput<AppData>> = {},
): Phase21dCloudReadMirrorVerificationInput<AppData> => ({
  enabled: true,
  shadowCandidate: ready21c(),
  readRepository: cloudMissingRepository(),
  schemaValidator: (value) => value.schemaVersion === emptyData().schemaVersion,
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
  verificationId: 'phase21d-verification-1',
  ...overrides,
});

describe('Phase 21D cloud read mirror verification', () => {
  it('is disabled by default and never applies cloud data', () => {
    const result = buildCloudReadMirrorVerification();

    expect(result).toMatchObject({
      baseId: PHASE21D_CLOUD_READ_MIRROR_VERIFICATION_ID,
      phase: '21D',
      ok: false,
      status: 'disabled',
      readyFor21E: false,
      readVerification: null,
      cloudReadAttempted: false,
      cloudReadMirrorVerified: false,
      cloudMissingAcceptedForFirstUpload: false,
      uploadPerformed: false,
      downloadPerformed: false,
      cloudWriteAttempted: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining(['verification_disabled', 'phase21c_not_ready']),
    });
  });

  it('requires 21C readiness and explicit read mirror verification', () => {
    const notReady21c = buildCloudReadMirrorVerification(validInput({
      shadowCandidate: {
        ...ready21c(),
        ok: false,
        readyFor21D: false,
        shadowCandidateAccepted: false,
      },
    }));
    const missingConfirmation = buildCloudReadMirrorVerification(validInput({
      explicitReadMirrorVerification: false,
    }));

    expect(notReady21c).toMatchObject({
      ok: false,
      status: 'phase21c_not_ready',
      cloudReadAttempted: false,
      blockers: expect.arrayContaining(['phase21c_not_ready', 'shadow_candidate_missing']),
    });
    expect(missingConfirmation).toMatchObject({
      ok: false,
      status: 'explicit_verification_missing',
      cloudReadAttempted: false,
      blockers: expect.arrayContaining(['explicit_read_verification_missing']),
    });
  });

  it('accepts cloud missing as a safe read mirror result before first upload apply', () => {
    const result = buildCloudReadMirrorVerification(validInput());

    expect(result).toMatchObject({
      id: 'phase21d-verification-1',
      ok: true,
      status: 'mirror_verified',
      readyFor21E: true,
      cloudReadAttempted: true,
      cloudReadMirrorVerified: true,
      cloudMissingAcceptedForFirstUpload: true,
      manualReviewRequired: false,
      requiresFirstUploadExplicitApply: true,
      requiresConflictReviewBeforeApply: true,
      uploadPerformed: false,
      downloadPerformed: false,
      cloudWriteAttempted: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      nextPhase: '21E - First Upload Explicit Apply V1',
      createdAt: nowIso,
      readVerification: {
        status: 'cloud_missing',
        applied: false,
        cloudWriteAttempted: false,
        localDataChanged: false,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
      },
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'read_mirror_only',
      'first_upload_apply_still_required',
      'manual_review_required_on_difference',
      'no_upload_performed',
      'no_cloud_write_performed',
      'localStorage_remains_fallback',
    ]));
  });

  it('accepts an exact mirrored snapshot without applying cloud data', () => {
    const data = emptyData();
    const shadowCandidate = ready21c(data);
    const result = buildCloudReadMirrorVerification(validInput({
      shadowCandidate,
      readRepository: repositoryWithSnapshot(cloudSnapshot(data, shadowCandidate)),
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'mirror_verified',
      readyFor21E: true,
      cloudReadMirrorVerified: true,
      cloudMissingAcceptedForFirstUpload: false,
      manualReviewRequired: false,
      readVerification: {
        status: 'mirrored',
        requiresManualReview: false,
        mirror: {
          hashMatch: true,
          schemaMatch: true,
          ownerMatch: true,
          freshness: 'same_updated_at',
        },
      },
    });
  });

  it('blocks mismatched cloud metadata for manual review before upload apply', () => {
    const data = emptyData();
    const shadowCandidate = ready21c(data);
    const result = buildCloudReadMirrorVerification(validInput({
      shadowCandidate,
      readRepository: repositoryWithSnapshot(cloudSnapshot(data, shadowCandidate, {
        sourceSnapshotHash: 'different-cloud-hash',
        createdAt: '2026-05-25T15:01:00.000Z',
      })),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_review_required',
      readyFor21E: false,
      cloudReadAttempted: true,
      cloudReadMirrorVerified: false,
      manualReviewRequired: true,
      blockers: expect.arrayContaining(['cloud_read_manual_review']),
      readVerification: {
        status: 'review_required',
        requiresManualReview: true,
      },
    });
  });

  it('fails closed on rejected cloud data and unsafe runtime evidence', () => {
    const data = emptyData();
    const shadowCandidate = ready21c(data);
    const rejected = buildCloudReadMirrorVerification(validInput({
      shadowCandidate,
      readRepository: repositoryWithSnapshot(cloudSnapshot(data, shadowCandidate, {
        owner: {
          scope: 'cloud-account-candidate',
          ownerId: 'other-account',
          accountId: 'other-account',
        },
      })),
    }));
    const unsafe = buildCloudReadMirrorVerification(validInput({
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

    expect(rejected).toMatchObject({
      ok: false,
      status: 'cloud_read_rejected',
      readyFor21E: false,
      cloudReadAttempted: true,
      blockers: expect.arrayContaining(['cloud_read_rejected']),
      readVerification: {
        status: 'rejected',
        applied: false,
        sourceOfTruthChanged: false,
      },
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21E: false,
      cloudReadAttempted: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'sync_runtime_enabled',
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
    const input = validInput({ verificationId: undefined });
    const before = JSON.parse(JSON.stringify(input));

    const first = buildCloudReadMirrorVerification(input);
    const second = buildCloudReadMirrorVerification(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
