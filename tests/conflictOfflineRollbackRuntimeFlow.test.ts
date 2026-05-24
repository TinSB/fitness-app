import { describe, expect, it } from 'vitest';
import {
  buildConflictOfflineRollbackRuntimeFlow,
  PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID,
  type Phase20gConflictOfflineRollbackInput,
} from '../src/cloudProduction/conflictOfflineRollbackRuntimeFlow';
import { buildCloudReadWriteVerificationFlow } from '../src/cloudProduction/cloudReadWriteVerificationFlow';
import { buildLocalBackupDryRunMigrationRuntimeFlow } from '../src/cloudProduction/localBackupDryRunMigrationRuntimeFlow';
import type { CloudAppDataRepositoryCandidateResult } from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-24T23:00:00.000Z';

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

const readRepository = () => ({
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

const build20fReady = (data = appData()) =>
  buildCloudReadWriteVerificationFlow({
    enabled: true,
    explicitVerificationOptIn: true,
    manualConfirmation: true,
    localBackupDryRun: build20eReady(data),
    appData: data,
    schemaValidator: (value) => value.schemaVersion === emptyData().schemaVersion,
    readRepository: readRepository(),
    writeShadowAdapter: () => ({
      ok: true,
      rollbackAvailable: true,
      message: 'Cloud write candidate accepted.',
    }),
    nowIso,
    operationId: 'phase20f-operation-1',
    requestFingerprint: 'phase20f-request-1',
    verificationId: 'phase20f-verification-1',
  });

const conflictReview = () => ({
  reviewed: true,
  manualResolutionRequired: false,
  canAutoApply: false,
  conflictType: null,
  resolutionCandidateReady: true,
  localDataChanged: false,
  cloudDataChanged: false,
  sourceOfTruthChanged: false,
});

const offlineProof = () => ({
  localTrainingAvailable: true,
  backgroundWorkDisabled: true,
  noFakeSuccess: true,
  canContinueWhenCloudUnavailable: true,
});

const rollbackProof = () => ({
  rollbackAvailable: true,
  emergencyLocalAvailable: true,
  fallbackLocalStorageAvailable: true,
  localDataDeleted: false,
  sourceOfTruthChanged: false,
});

const boundaryProof = () => ({
  routesChanged: false,
  packageChanged: false,
  schemaChanged: false,
});

const validInput = (
  overrides: Partial<Phase20gConflictOfflineRollbackInput<AppData>> = {},
): Phase20gConflictOfflineRollbackInput<AppData> => ({
  enabled: true,
  verificationFlow: build20fReady(),
  conflictReview: conflictReview(),
  offlineProof: offlineProof(),
  rollbackProof: rollbackProof(),
  boundaryProof: boundaryProof(),
  nowIso,
  flowId: 'phase20g-flow-1',
  ...overrides,
});

describe('Phase 20G conflict offline rollback runtime flow', () => {
  it('is disabled by default and does not apply sync or change source of truth', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow();

    expect(result).toMatchObject({
      baseId: PHASE20G_CONFLICT_OFFLINE_ROLLBACK_RUNTIME_FLOW_ID,
      phase: '20G',
      ok: false,
      status: 'disabled',
      readyFor20H: false,
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
      productionLaunchPerformed: false,
      blockers: expect.arrayContaining([
        'flow_disabled',
        'phase20f_not_ready',
        'cloud_write_candidate_missing',
      ]),
    });
  });

  it('passes only after conflict review offline rollback emergency local and boundary proofs pass', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildConflictOfflineRollbackRuntimeFlow(input);

    expect(result).toMatchObject({
      id: 'phase20g-flow-1',
      ok: true,
      status: 'ready_for_production_acceptance',
      readyFor20H: true,
      blockers: [],
      userMessage: '本地数据仍会保留',
      conflictReviewAccepted: true,
      offlineAccepted: true,
      rollbackAccepted: true,
      emergencyLocalAccepted: true,
      routeBoundaryAccepted: true,
      cloudWriteCandidateAccepted: true,
      cloudReadAttempted: true,
      cloudWriteAttempted: true,
      syncRuntimeEnabled: true,
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
      localStorageFallbackPreserved: true,
      productionLaunchPerformed: false,
      nextPhase: '20H - Production Acceptance With Synthetic Data V1',
      createdAt: nowIso,
      acceptance: {
        ok: true,
        status: 'acceptance_passed',
        acceptedForManualProductionReview: true,
      },
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'runtime_flow_only',
      'manual_review_required',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
      'no_default_or_background_sync',
    ]));
    expect(input).toEqual(before);
  });

  it('requires 20F verification readiness and a write candidate', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow(validInput({
      verificationFlow: {
        ...build20fReady(),
        ok: false,
        readyFor20G: false,
        cloudWriteCandidateAccepted: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20f_not_ready',
      readyFor20H: false,
      blockers: expect.arrayContaining([
        'phase20f_not_ready',
        'cloud_write_candidate_missing',
      ]),
    });
  });

  it('requires conflict review and blocks automatic apply', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow(validInput({
      conflictReview: {
        ...conflictReview(),
        reviewed: false,
        canAutoApply: true,
        resolutionCandidateReady: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'conflict_review_missing',
      readyFor20H: false,
      blockers: expect.arrayContaining([
        'conflict_review_missing',
        'auto_apply_available',
      ]),
      autoApplied: false,
    });
  });

  it('requires offline training fallback and no fake success', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow(validInput({
      offlineProof: {
        localTrainingAvailable: false,
        backgroundWorkDisabled: false,
        noFakeSuccess: false,
        canContinueWhenCloudUnavailable: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'offline_unavailable',
      blockers: expect.arrayContaining([
        'offline_training_unavailable',
        'background_work_not_disabled',
        'fake_success_possible',
        'cloud_unavailable_blocks_training',
      ]),
    });
  });

  it('requires rollback emergency local and fallback localStorage availability', () => {
    const rollbackMissing = buildConflictOfflineRollbackRuntimeFlow(validInput({
      rollbackProof: {
        ...rollbackProof(),
        rollbackAvailable: false,
      },
    }));
    expect(rollbackMissing).toMatchObject({
      ok: false,
      status: 'rollback_unavailable',
      blockers: expect.arrayContaining(['rollback_unavailable']),
    });

    const emergencyMissing = buildConflictOfflineRollbackRuntimeFlow(validInput({
      rollbackProof: {
        ...rollbackProof(),
        emergencyLocalAvailable: false,
      },
    }));
    expect(emergencyMissing).toMatchObject({
      ok: false,
      status: 'emergency_local_unavailable',
      blockers: expect.arrayContaining(['emergency_local_unavailable']),
    });

    const fallbackMissing = buildConflictOfflineRollbackRuntimeFlow(validInput({
      rollbackProof: {
        ...rollbackProof(),
        fallbackLocalStorageAvailable: false,
      },
    }));
    expect(fallbackMissing).toMatchObject({
      ok: false,
      status: 'source_of_truth_unsafe',
      localStorageFallbackPreserved: false,
      blockers: expect.arrayContaining(['fallback_localStorage_unavailable']),
    });
  });

  it('blocks route package or schema boundary drift', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow(validInput({
      boundaryProof: {
        routesChanged: true,
        packageChanged: true,
        schemaChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'boundary_drift',
      routeBoundaryAccepted: false,
      blockers: expect.arrayContaining([
        'route_boundary_changed',
        'package_or_lockfile_changed',
        'schema_changed',
      ]),
    });
  });

  it('fails closed when runtime boundary evidence is already unsafe', () => {
    const result = buildConflictOfflineRollbackRuntimeFlow(validInput({
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
      status: 'source_of_truth_unsafe',
      readyFor20H: false,
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
    const input = validInput({ flowId: undefined });

    const first = buildConflictOfflineRollbackRuntimeFlow(input);
    const second = buildConflictOfflineRollbackRuntimeFlow(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
