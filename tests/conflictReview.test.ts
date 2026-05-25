import { describe, expect, it } from 'vitest';
import {
  buildConflictReview,
  PHASE21G_CONFLICT_REVIEW_ID,
  type Phase21gConflictReviewInput,
} from '../src/cloudProduction/conflictReview';
import type { Phase21fCloudParityCheckResult } from '../src/cloudProduction/cloudParityCheck';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T18:00:00.000Z';

const receipt = {
  snapshotId: 'cloud-snapshot-upload-1',
  operationId: 'phase21g-operation-1',
  accountId: 'account-1',
  ownerUserId: 'account-1',
  sourceSnapshotHash: 'local-hash-1',
  schemaVersion: '1',
  createdAt: nowIso,
};

const parity = () => ({
  localSnapshotHash: 'local-hash-1',
  cloudMetadataHash: 'local-hash-1',
  cloudAppDataHash: 'local-hash-1',
  receiptSourceSnapshotHash: 'local-hash-1',
  snapshotId: 'cloud-snapshot-upload-1',
  operationId: 'phase21g-operation-1',
  accountId: 'account-1',
  ownerUserId: 'account-1',
  schemaVersion: '1',
  createdAt: nowIso,
  localMatchesReceipt: true,
  cloudMetadataMatchesReceipt: true,
  cloudAppDataMatchesReceipt: true,
  snapshotIdMatchesReceipt: true,
  operationIdMatchesReceipt: true,
  ownerMatchesReceipt: true,
  schemaMatchesReceipt: true,
  createdAtMatchesReceipt: true,
});

const parityOk = (): Phase21fCloudParityCheckResult<AppData> => ({
  id: 'phase21f-parity-1',
  baseId: 'phase21f-cloud-parity-check',
  phase: '21F',
  ok: true,
  status: 'parity_verified',
  readyFor21G: true,
  blockers: [],
  warnings: [
    'read_after_upload_only',
    'localStorage_remains_fallback',
    'no_new_upload_performed',
    'no_download_performed',
    'no_auto_apply',
    'manual_conflict_required_on_difference',
    'cloud_primary_not_enabled',
    'no_default_or_background_sync',
  ],
  userMessage: '同步完成',
  firstUploadReceipt: receipt,
  readAfterUpload: null,
  parity: parity(),
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
  localStorageFallbackPreserved: true,
  requiresConflictReviewBeforeApply: true,
  requiresRollbackIfParityFails: true,
  nextPhase: '21G - Conflict Review V1',
  createdAt: nowIso,
});

const parityConflict = (): Phase21fCloudParityCheckResult<AppData> => ({
  ...parityOk(),
  ok: false,
  status: 'parity_mismatch',
  readyFor21G: false,
  blockers: ['local_hash_mismatch'],
  userMessage: '发现冲突',
  parity: {
    ...parity(),
    localSnapshotHash: 'local-hash-after-edit',
    localMatchesReceipt: false,
  },
  cloudReadAfterUploadVerified: false,
  localParityVerified: false,
  uploadReceiptVerified: false,
  conflictReviewRequired: true,
});

const validInput = (
  overrides: Partial<Phase21gConflictReviewInput<AppData>> = {},
): Phase21gConflictReviewInput<AppData> => ({
  enabled: true,
  parityCheck: parityConflict(),
  reviewOpened: true,
  selectedResolution: 'keep_local',
  explicitResolutionConfirmation: true,
  localStorageFallbackConfirmed: true,
  noAutoApplyConfirmed: true,
  backupStillAvailableConfirmed: true,
  ownerValidated: true,
  schemaValidated: true,
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
  reviewId: 'phase21g-review-1',
  ...overrides,
});

describe('Phase 21G conflict review', () => {
  it('is disabled by default and makes no conflict decision', () => {
    const result = buildConflictReview();

    expect(result).toMatchObject({
      baseId: PHASE21G_CONFLICT_REVIEW_ID,
      phase: '21G',
      ok: false,
      status: 'disabled',
      readyFor21H: false,
      conflictDetected: false,
      conflictReviewVisible: false,
      manualResolutionRequired: false,
      manualResolutionConfirmed: false,
      automaticConflictDecisionMade: false,
      keepLocalAvailable: false,
      useCloudAvailable: false,
      keepLocalChosen: false,
      useCloudChosen: false,
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
      blockers: expect.arrayContaining(['review_disabled', 'cloud_parity_missing']),
    });
  });

  it('passes through a no-conflict parity result without inventing a decision', () => {
    const result = buildConflictReview(validInput({
      parityCheck: parityOk(),
      reviewOpened: false,
      selectedResolution: null,
      explicitResolutionConfirmation: false,
      ownerValidated: false,
      schemaValidated: false,
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'conflict_reviewed',
      readyFor21H: true,
      userMessage: '同步完成',
      conflictDetected: false,
      noConflictDetected: true,
      manualResolutionRequired: false,
      manualResolutionConfirmed: false,
      automaticConflictDecisionMade: false,
      resolutionCandidate: null,
      cloudReadAfterUploadVerified: true,
      localParityVerified: true,
      uploadReceiptVerified: true,
      syncRuntimeEnabled: true,
      nextPhase: '21H - Offline Rollback V1',
    });
  });

  it('records an explicit keep-local review without applying data', () => {
    const input = validInput({ selectedResolution: 'keep_local' });
    const before = JSON.parse(JSON.stringify(input));

    const result = buildConflictReview(input);

    expect(result).toMatchObject({
      id: 'phase21g-review-1',
      ok: true,
      status: 'conflict_reviewed',
      readyFor21H: true,
      userMessage: '发现冲突',
      blockers: [],
      conflictDetected: true,
      conflictReviewVisible: true,
      manualResolutionRequired: true,
      manualResolutionConfirmed: true,
      automaticConflictDecisionMade: false,
      keepLocalAvailable: true,
      useCloudAvailable: true,
      keepLocalChosen: true,
      useCloudChosen: false,
      decisionApplied: false,
      newUploadPerformed: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudDataChanged: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      requiresOfflineRollbackBeforeProduction: true,
      conflictReview: {
        selectedResolution: 'keep_local',
        keepLocalLabel: '保留本地',
        useCloudLabel: '使用云端',
        localSnapshotHash: 'local-hash-after-edit',
        receiptSourceSnapshotHash: 'local-hash-1',
      },
      resolutionCandidate: {
        action: 'keep_local',
        confirmed: true,
        aborted: false,
        localDataChanged: false,
        cloudDataChanged: false,
        sourceOfTruthChanged: false,
      },
    });
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'manual_conflict_review_only',
      'localStorage_remains_fallback',
      'no_automatic_conflict_choice',
      'no_download_performed',
      'no_auto_apply',
      'cloud_primary_not_enabled',
    ]));
  });

  it('requires backup confirmation before use-cloud can be recorded', () => {
    const missingBackup = buildConflictReview(validInput({
      selectedResolution: 'use_cloud',
      backupStillAvailableConfirmed: false,
    }));
    const accepted = buildConflictReview(validInput({
      selectedResolution: 'use_cloud',
      backupStillAvailableConfirmed: true,
    }));

    expect(missingBackup).toMatchObject({
      ok: false,
      status: 'backup_required',
      readyFor21H: false,
      useCloudChosen: false,
      decisionApplied: false,
      blockers: expect.arrayContaining(['backup_still_available_not_confirmed']),
    });
    expect(accepted).toMatchObject({
      ok: true,
      status: 'conflict_reviewed',
      useCloudChosen: true,
      keepLocalChosen: false,
      decisionApplied: false,
      resolutionCandidate: {
        action: 'keep_cloud',
        aborted: false,
      },
    });
  });

  it('requires opening review, choosing manually, confirming, and never accepts an automatic decision', () => {
    const notOpened = buildConflictReview(validInput({ reviewOpened: false }));
    const noChoice = buildConflictReview(validInput({ selectedResolution: null }));
    const noConfirmation = buildConflictReview(validInput({ explicitResolutionConfirmation: false }));
    const automaticAttempt = buildConflictReview(validInput({ automaticResolutionAttempted: true }));

    expect(notOpened).toMatchObject({
      ok: false,
      status: 'review_required',
      blockers: expect.arrayContaining(['conflict_review_missing']),
    });
    expect(noChoice).toMatchObject({
      ok: false,
      status: 'resolution_missing',
      blockers: expect.arrayContaining(['resolution_choice_missing']),
      automaticConflictDecisionMade: false,
    });
    expect(noConfirmation).toMatchObject({
      ok: false,
      status: 'confirmation_missing',
      blockers: expect.arrayContaining(['explicit_resolution_confirmation_missing']),
      resolutionCandidate: {
        aborted: true,
      },
    });
    expect(automaticAttempt).toMatchObject({
      ok: false,
      status: 'resolution_missing',
      automaticConflictDecisionMade: false,
      blockers: expect.arrayContaining(['automatic_conflict_decision_attempted']),
    });
  });

  it('fails closed on missing owner/schema validation and unsafe runtime evidence', () => {
    const validationMissing = buildConflictReview(validInput({
      ownerValidated: false,
      schemaValidated: false,
    }));
    const unsafe = buildConflictReview(validInput({
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

    expect(validationMissing).toMatchObject({
      ok: false,
      status: 'validation_missing',
      blockers: expect.arrayContaining(['owner_validation_missing', 'schema_validation_missing']),
      localDataChanged: false,
      cloudDataChanged: false,
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21H: false,
      cloudWriteAttempted: false,
      uploadPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
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

  it('requires 21F parity evidence and uses deterministic ids', () => {
    const notReady = buildConflictReview(validInput({
      parityCheck: {
        ...parityOk(),
        ok: false,
        readyFor21G: false,
        conflictReviewRequired: false,
        firstUploadPreviouslyPerformed: false,
      },
    }));
    const input = validInput({ reviewId: undefined });

    const first = buildConflictReview(input);
    const second = buildConflictReview(input);

    expect(notReady).toMatchObject({
      ok: false,
      status: 'phase21f_not_ready',
      blockers: expect.arrayContaining(['phase21f_not_ready']),
    });
    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
