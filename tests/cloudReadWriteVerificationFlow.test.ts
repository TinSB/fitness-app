import { describe, expect, it } from 'vitest';
import {
  buildCloudReadWriteVerificationFlow,
  PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID,
  type Phase20fCloudReadWriteVerificationInput,
} from '../src/cloudProduction/cloudReadWriteVerificationFlow';
import { buildLocalBackupDryRunMigrationRuntimeFlow } from '../src/cloudProduction/localBackupDryRunMigrationRuntimeFlow';
import type { CloudAppDataRepositoryCandidateResult, CloudAppDataSnapshotCandidate } from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-24T22:00:00.000Z';

const appData = () => emptyData();

const build20eReady = (data = appData()) =>
  buildLocalBackupDryRunMigrationRuntimeFlow({
    enabled: true,
    syncRuntime: {
      readyFor20E: true,
      syncRuntimeEnabled: true,
      user: {
        userId: 'account-1',
        accountId: 'account-1',
      },
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    appData: data,
    backupJson: exportAppData(data),
    backupExportConfirmed: true,
    deviceId: 'device-1',
    schemaValidator: (value) => value.schemaVersion === emptyData().schemaVersion,
    cloudRepositoryAvailable: true,
    cloudReadMirror: {
      status: 'cloud_missing',
      requiresManualReview: false,
    },
    rlsPreflightPassed: true,
    rollbackAvailable: true,
    nowIso,
    operationId: 'phase20e-operation-1',
    requestFingerprint: 'phase20e-request-1',
    flowId: 'phase20e-flow-1',
  });

const missingReadRepository = (): Phase20fCloudReadWriteVerificationInput<AppData>['readRepository'] => ({
  readLatestCloudAppDataCandidate: (): CloudAppDataRepositoryCandidateResult<AppData> => ({
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

const mirroredReadRepository = (data: AppData, sourceSnapshotHash: string):
  Phase20fCloudReadWriteVerificationInput<AppData>['readRepository'] => ({
    readLatestCloudAppDataCandidate: (): CloudAppDataRepositoryCandidateResult<AppData> => ({
      ok: true,
      status: 'read_candidate',
      snapshot: {
        snapshotId: 'cloud-snapshot-1',
        accountId: 'account-1',
        ownerUserId: 'account-1',
        owner: {
          scope: 'cloud-account-candidate',
          ownerId: 'account-1',
          accountId: 'account-1',
          deviceId: 'device-1',
        },
        appData: data,
        schemaVersion: String(data.schemaVersion),
        sourceSnapshotHash,
        operationId: 'phase20f-operation-1',
        validationStatus: 'valid',
        createdAt: nowIso,
      } satisfies CloudAppDataSnapshotCandidate<AppData>,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: true,
      message: 'Cloud snapshot mirrored.',
    }),
  });

const rejectedReadRepository = (data: AppData):
  Phase20fCloudReadWriteVerificationInput<AppData>['readRepository'] => ({
    readLatestCloudAppDataCandidate: (): CloudAppDataRepositoryCandidateResult<AppData> => ({
      ok: true,
      status: 'read_candidate',
      snapshot: {
        snapshotId: 'cloud-snapshot-foreign',
        accountId: 'other-account',
        ownerUserId: 'other-account',
        owner: {
          scope: 'cloud-account-candidate',
          ownerId: 'other-account',
          accountId: 'other-account',
        },
        appData: data,
        schemaVersion: String(data.schemaVersion),
        sourceSnapshotHash: 'foreign-hash',
        operationId: 'phase20f-operation-foreign',
        validationStatus: 'valid',
        createdAt: nowIso,
      },
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      manualConfirmationRequired: true,
      message: 'Foreign cloud snapshot.',
    }),
  });

const validInput = (
  overrides: Partial<Phase20fCloudReadWriteVerificationInput<AppData>> = {},
): Phase20fCloudReadWriteVerificationInput<AppData> => {
  const data = appData();
  const localBackupDryRun = build20eReady(data);
  return {
    enabled: true,
    explicitVerificationOptIn: true,
    manualConfirmation: true,
    localBackupDryRun,
    appData: data,
    schemaValidator: (value) => value.schemaVersion === emptyData().schemaVersion,
    readRepository: missingReadRepository(),
    writeShadowAdapter: () => ({
      ok: true,
      rollbackAvailable: true,
      message: 'Cloud write candidate accepted.',
    }),
    nowIso,
    operationId: 'phase20f-operation-1',
    requestFingerprint: 'phase20f-request-1',
    verificationId: 'phase20f-verification-1',
    ...overrides,
  };
};

describe('Phase 20F cloud read/write verification flow', () => {
  it('is disabled by default and does not read write or mutate local state', () => {
    const result = buildCloudReadWriteVerificationFlow();

    expect(result).toMatchObject({
      baseId: PHASE20F_CLOUD_READ_WRITE_VERIFICATION_FLOW_ID,
      phase: '20F',
      ok: false,
      status: 'disabled',
      readyFor20G: false,
      cloudReadAttempted: false,
      cloudWriteAttempted: false,
      cloudWriteCandidateAccepted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'flow_disabled',
        'phase20e_not_ready',
        'appdata_missing',
      ]),
    });
  });

  it('verifies cloud read missing as safe and accepts a write-shadow candidate after 20E readiness', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildCloudReadWriteVerificationFlow(input);

    expect(result).toMatchObject({
      id: 'phase20f-verification-1',
      ok: true,
      status: 'verified',
      readyFor20G: true,
      blockers: [],
      userMessage: '查看后再继续',
      cloudReadAttempted: true,
      cloudWriteAttempted: true,
      cloudWriteCandidateAccepted: true,
      syncRuntimeEnabled: true,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      cloudPrimaryChanged: false,
      nextPhase: '20G - Conflict/Offline/Rollback Runtime Flow V1',
      createdAt: nowIso,
      readVerification: {
        status: 'cloud_missing',
        localDataChanged: false,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
      },
      writeVerification: {
        ok: true,
        status: 'accepted_shadow',
        shadowWriteAttempted: true,
        applied: false,
        localDataChanged: false,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
        cloudPrimaryChanged: false,
      },
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'verification_only',
      'explicit_manual_flow',
      'localStorage_remains_fallback',
      'no_auto_apply',
      'cloud_primary_not_enabled',
      'no_default_or_background_sync',
    ]));
    expect(input.appData).toEqual(before);
  });

  it('allows mirrored read metadata before write-shadow verification', () => {
    const data = appData();
    const localBackupDryRun = build20eReady(data);
    const sourceSnapshotHash = localBackupDryRun.accountInventory.appDataSummary?.sourceSnapshotHash as string;

    const result = buildCloudReadWriteVerificationFlow(validInput({
      appData: data,
      localBackupDryRun,
      readRepository: mirroredReadRepository(data, sourceSnapshotHash),
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'verified',
      readVerification: {
        status: 'mirrored',
        requiresManualReview: false,
      },
      writeVerification: {
        status: 'accepted_shadow',
      },
    });
  });

  it('requires 20E local backup dry-run readiness', () => {
    const result = buildCloudReadWriteVerificationFlow(validInput({
      localBackupDryRun: {
        ...build20eReady(),
        ok: false,
        readyFor20F: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20e_not_ready',
      readyFor20G: false,
      cloudReadAttempted: false,
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining(['phase20e_not_ready']),
    });
  });

  it('requires explicit verification opt-in and manual confirmation', () => {
    const result = buildCloudReadWriteVerificationFlow(validInput({
      explicitVerificationOptIn: false,
      manualConfirmation: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_confirmation_missing',
      readyFor20G: false,
      cloudReadAttempted: false,
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining([
        'verification_opt_in_missing',
        'manual_confirmation_missing',
      ]),
    });
  });

  it('blocks rejected cloud read evidence before write verification', () => {
    const data = appData();
    const result = buildCloudReadWriteVerificationFlow(validInput({
      appData: data,
      readRepository: rejectedReadRepository(data),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'read_verification_blocked',
      readyFor20G: false,
      cloudReadAttempted: true,
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining(['cloud_read_rejected']),
      readVerification: {
        status: 'rejected',
        applied: false,
        cloudWriteAttempted: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
      },
      writeVerification: null,
    });
  });

  it('blocks review-required cloud read evidence before write verification', () => {
    const data = appData();
    const localBackupDryRun = build20eReady(data);
    const result = buildCloudReadWriteVerificationFlow(validInput({
      appData: data,
      localBackupDryRun,
      readRepository: mirroredReadRepository(data, 'different-cloud-hash'),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_review_required',
      readyFor20G: false,
      cloudReadAttempted: true,
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining(['cloud_read_manual_review']),
      readVerification: {
        status: 'review_required',
        requiresManualReview: true,
      },
      writeVerification: null,
    });
  });

  it('blocks missing or rejected write-shadow adapter evidence', () => {
    const missingAdapter = buildCloudReadWriteVerificationFlow(validInput({
      writeShadowAdapter: null,
    }));
    expect(missingAdapter).toMatchObject({
      ok: false,
      status: 'write_verification_blocked',
      cloudReadAttempted: true,
      cloudWriteAttempted: false,
      blockers: expect.arrayContaining(['write_adapter_unavailable']),
    });

    const rejectedWrite = buildCloudReadWriteVerificationFlow(validInput({
      writeShadowAdapter: () => ({
        ok: false,
        rollbackAvailable: true,
        message: 'Rejected.',
      }),
    }));
    expect(rejectedWrite).toMatchObject({
      ok: false,
      status: 'write_verification_blocked',
      cloudReadAttempted: true,
      cloudWriteAttempted: true,
      blockers: expect.arrayContaining(['write_shadow_rejected']),
    });
  });

  it('blocks duplicate write-shadow candidates', () => {
    const accepted = buildCloudReadWriteVerificationFlow(validInput());
    const duplicate = buildCloudReadWriteVerificationFlow(validInput({
      existingJournalEntries: accepted.writeVerification?.journalEntry
        ? [accepted.writeVerification.journalEntry]
        : [],
    }));

    expect(duplicate).toMatchObject({
      ok: false,
      status: 'write_verification_blocked',
      readyFor20G: false,
      blockers: expect.arrayContaining(['duplicate_write_candidate']),
      writeVerification: {
        status: 'duplicate_shadow',
        shadowWriteAttempted: false,
      },
    });
  });

  it('fails closed when runtime boundary evidence is already unsafe', () => {
    const result = buildCloudReadWriteVerificationFlow(validInput({
      runtimeBoundary: {
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'write_verification_blocked',
      readyFor20G: false,
      cloudReadAttempted: false,
      cloudWriteAttempted: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit id is supplied', () => {
    const input = validInput({ verificationId: undefined });

    const first = buildCloudReadWriteVerificationFlow(input);
    const second = buildCloudReadWriteVerificationFlow(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
