import { describe, expect, it } from 'vitest';
import {
  buildOfflineRollback,
  PHASE21H_OFFLINE_ROLLBACK_ID,
  type Phase21hOfflineRollbackInput,
} from '../src/cloudProduction/offlineRollback';
import type { Phase21gConflictReviewResult } from '../src/cloudProduction/conflictReview';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T19:00:00.000Z';

const conflictReviewReady = (): Phase21gConflictReviewResult<AppData> => ({
  id: 'phase21g-review-1',
  baseId: 'phase21g-conflict-review',
  phase: '21G',
  ok: true,
  status: 'conflict_reviewed',
  readyFor21H: true,
  blockers: [],
  warnings: [
    'manual_conflict_review_only',
    'localStorage_remains_fallback',
    'no_automatic_conflict_choice',
    'no_download_performed',
    'no_auto_apply',
    'no_new_upload_performed',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ],
  userMessage: '发现冲突',
  conflictReview: {
    conflictDetected: true,
    selectedResolution: 'keep_local',
    keepLocalLabel: '保留本地',
    useCloudLabel: '使用云端',
    localSnapshotHash: 'local-hash-after-edit',
    cloudSnapshotHash: 'cloud-hash-1',
    receiptSourceSnapshotHash: 'local-hash-1',
    cloudReadAfterUploadVerified: false,
    localParityVerified: false,
    uploadReceiptVerified: false,
  },
  resolutionCandidate: {
    action: 'keep_local',
    confirmed: true,
    backupRequired: false,
    backupCreated: true,
    ownerValidated: true,
    schemaValidated: true,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    aborted: false,
    reason: 'Manual conflict resolution candidate is ready for review.',
  },
  conflictDetected: true,
  conflictReviewVisible: true,
  manualResolutionRequired: true,
  manualResolutionConfirmed: true,
  automaticConflictDecisionMade: false,
  keepLocalAvailable: true,
  useCloudAvailable: true,
  keepLocalChosen: true,
  useCloudChosen: false,
  noConflictDetected: false,
  firstUploadPreviouslyPerformed: true,
  cloudReadAttempted: true,
  cloudReadAfterUploadVerified: false,
  localParityVerified: false,
  uploadReceiptVerified: false,
  decisionApplied: false,
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
  localStorageFallbackPreserved: true,
  requiresOfflineRollbackBeforeProduction: true,
  nextPhase: '21H - Offline Rollback V1',
  createdAt: nowIso,
});

const validInput = (
  overrides: Partial<Phase21hOfflineRollbackInput<AppData>> = {},
): Phase21hOfflineRollbackInput<AppData> => ({
  enabled: true,
  conflictReview: conflictReviewReady(),
  offlineTrainingAvailable: true,
  cloudUnavailableDoesNotBlockTraining: true,
  noFakeSuccessConfirmed: true,
  localStorageAvailable: true,
  emergencyBackupAvailable: true,
  rollbackSnapshotAvailable: true,
  rollbackRequested: false,
  restoreLocalModeRequested: false,
  explicitRestoreLocalModeConfirmation: false,
  cloudUnavailable: true,
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
  offlineRollbackId: 'phase21h-offline-1',
  ...overrides,
});

describe('Phase 21H offline rollback', () => {
  it('is disabled by default and does not mutate local or cloud data', () => {
    const result = buildOfflineRollback();

    expect(result).toMatchObject({
      baseId: PHASE21H_OFFLINE_ROLLBACK_ID,
      phase: '21H',
      ok: false,
      status: 'disabled',
      readyFor21I: false,
      conflictReviewAccepted: false,
      offlineTrainingAvailable: false,
      cloudUnavailableAccepted: false,
      rollbackPerformed: false,
      emergencyLocalAvailable: false,
      restoreLocalModeConfirmed: false,
      automaticConflictDecisionMade: false,
      decisionApplied: false,
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
      localDataDeleted: false,
      blockers: expect.arrayContaining([
        'offline_rollback_disabled',
        'phase21g_not_ready',
      ]),
    });
  });

  it('accepts offline training, rollback, emergency local, and cloud-unavailable fallback evidence', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildOfflineRollback(input);

    expect(result).toMatchObject({
      id: 'phase21h-offline-1',
      ok: true,
      status: 'offline_rollback_ready',
      readyFor21I: true,
      blockers: [],
      userMessage: '本地数据仍会保留',
      conflictReviewAccepted: true,
      offlineTrainingAvailable: true,
      cloudUnavailableAccepted: true,
      rollbackAvailable: true,
      rollbackPerformed: false,
      emergencyLocalAvailable: true,
      restoreLocalModeAvailable: true,
      restoreLocalModeConfirmed: false,
      restoreLocalModeLabel: '恢复本地模式',
      localAppAvailable: true,
      cloudCandidateDisabled: true,
      firstUploadPreviouslyPerformed: true,
      manualResolutionConfirmed: true,
      automaticConflictDecisionMade: false,
      decisionApplied: false,
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
      localStorageFallbackPreserved: true,
      localDataDeleted: false,
      requiresProductionAcceptance: true,
      nextPhase: '21I - Production Full Acceptance V1',
      fallback: {
        localAppAvailable: true,
        fallbackLocalStorageAvailable: true,
        emergencyLocalAvailable: true,
        cloudCandidateDisabled: true,
        rollbackAvailable: true,
        rollbackPerformed: false,
        localDataDeleted: false,
        sourceOfTruthChanged: false,
      },
      releaseRollback: {
        cloudPullDisabled: true,
        cloudPushDisabled: true,
        supabaseAdapterDisabled: true,
        rollbackAvailable: true,
        localDataDeleted: false,
        sourceOfTruthChanged: false,
      },
    });
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'offline_rollback_only',
      'localStorage_remains_fallback',
      'emergency_local_available',
      'restore_local_mode_manual_only',
      'no_default_or_background_sync',
    ]));
  });

  it('performs only an explicit restore-local rollback candidate', () => {
    const missingConfirmation = buildOfflineRollback(validInput({
      rollbackRequested: true,
      restoreLocalModeRequested: true,
      explicitRestoreLocalModeConfirmation: false,
    }));
    const accepted = buildOfflineRollback(validInput({
      rollbackRequested: true,
      restoreLocalModeRequested: true,
      explicitRestoreLocalModeConfirmation: true,
    }));

    expect(missingConfirmation).toMatchObject({
      ok: false,
      status: 'confirmation_missing',
      readyFor21I: false,
      rollbackPerformed: false,
      restoreLocalModeConfirmed: false,
      blockers: expect.arrayContaining(['restore_local_confirmation_missing']),
    });
    expect(accepted).toMatchObject({
      ok: true,
      status: 'offline_rollback_ready',
      userMessage: '恢复本地模式',
      rollbackPerformed: true,
      restoreLocalModeConfirmed: true,
      syncRuntimeEnabled: false,
      fallback: {
        reason: 'emergency_local_mode',
        rollbackPerformed: true,
      },
      releaseRollback: {
        emergencyLocalModeForced: true,
        localStoragePrimaryRestored: true,
      },
    });
  });

  it('requires 21G review readiness and offline no-fake-success evidence', () => {
    const notReady21g = buildOfflineRollback(validInput({
      conflictReview: {
        ...conflictReviewReady(),
        ok: false,
        readyFor21H: false,
      },
    }));
    const offlineMissing = buildOfflineRollback(validInput({
      offlineTrainingAvailable: false,
      cloudUnavailableDoesNotBlockTraining: false,
      noFakeSuccessConfirmed: false,
    }));

    expect(notReady21g).toMatchObject({
      ok: false,
      status: 'phase21g_not_ready',
      blockers: expect.arrayContaining(['phase21g_not_ready']),
    });
    expect(offlineMissing).toMatchObject({
      ok: false,
      status: 'offline_unavailable',
      blockers: expect.arrayContaining([
        'offline_training_unavailable',
        'cloud_unavailable_blocks_training',
        'fake_success_possible',
      ]),
    });
  });

  it('blocks missing fallback, rollback, or emergency local evidence', () => {
    const fallbackMissing = buildOfflineRollback(validInput({
      localStorageAvailable: false,
    }));
    const rollbackMissing = buildOfflineRollback(validInput({
      localStorageAvailable: false,
      rollbackSnapshotAvailable: false,
    }));
    const emergencyMissing = buildOfflineRollback(validInput({
      emergencyBackupAvailable: false,
    }));

    expect(fallbackMissing).toMatchObject({
      ok: false,
      status: 'offline_unavailable',
      localStorageFallbackPreserved: false,
      blockers: expect.arrayContaining(['localStorage_fallback_unavailable']),
    });
    expect(rollbackMissing).toMatchObject({
      ok: false,
      status: 'offline_unavailable',
      rollbackAvailable: false,
      blockers: expect.arrayContaining(['rollback_unavailable']),
    });
    expect(emergencyMissing).toMatchObject({
      ok: false,
      status: 'emergency_local_unavailable',
      emergencyLocalAvailable: false,
      blockers: expect.arrayContaining(['emergency_local_unavailable']),
    });
  });

  it('fails closed on unsafe runtime evidence', () => {
    const result = buildOfflineRollback(validInput({
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

    expect(result).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21I: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      localDataDeleted: false,
      blockers: expect.arrayContaining([
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
    const input = validInput({ offlineRollbackId: undefined });
    const before = JSON.parse(JSON.stringify(input));

    const first = buildOfflineRollback(input);
    const second = buildOfflineRollback(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
