import { describe, expect, it } from 'vitest';
import {
  buildCloudWriteShadowCandidate,
  PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID,
  type Phase21cCloudWriteShadowCandidateInput,
} from '../src/cloudProduction/cloudWriteShadowCandidate';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildLocalBackupDryRunUi } from '../src/cloudProduction/localBackupDryRunUi';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-25T14:00:00.000Z';

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

const ready21b = (data: AppData = emptyData()) =>
  buildLocalBackupDryRunUi({
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

const validInput = (
  overrides: Partial<Phase21cCloudWriteShadowCandidateInput<AppData>> = {},
): Phase21cCloudWriteShadowCandidateInput<AppData> => {
  const data = emptyData();
  return {
    enabled: true,
    localBackupDryRunUi: ready21b(data),
    appData: data,
    schemaValidator: (value) => value.schemaVersion === data.schemaVersion,
    explicitShadowConfirmation: true,
    cloudConflictDetected: false,
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
    candidateId: 'phase21c-candidate-1',
    ...overrides,
  };
};

describe('Phase 21C cloud write shadow candidate', () => {
  it('is disabled by default and never moves data', () => {
    const result = buildCloudWriteShadowCandidate();

    expect(result).toMatchObject({
      baseId: PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID,
      phase: '21C',
      ok: false,
      status: 'disabled',
      readyFor21D: false,
      shadowCandidateReady: false,
      shadowCandidateAccepted: false,
      inMemoryShadowCandidateOnly: true,
      inMemoryShadowWriteAttempted: false,
      cloudWriteAttempted: false,
      cloudReadAttempted: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining(['candidate_disabled', 'phase21b_not_ready']),
    });
  });

  it('requires 21B readiness and explicit shadow confirmation', () => {
    const notReady21b = buildCloudWriteShadowCandidate(validInput({
      localBackupDryRunUi: {
        ...ready21b(),
        ok: false,
        readyFor21C: false,
        dryRunReady: false,
      },
    }));
    const missingConfirmation = buildCloudWriteShadowCandidate(validInput({
      explicitShadowConfirmation: false,
    }));

    expect(notReady21b).toMatchObject({
      ok: false,
      status: 'phase21b_not_ready',
      readyFor21D: false,
      inMemoryShadowWriteAttempted: false,
      blockers: expect.arrayContaining(['phase21b_not_ready', 'dry_run_missing']),
    });
    expect(missingConfirmation).toMatchObject({
      ok: false,
      status: 'explicit_confirmation_missing',
      readyFor21D: false,
      inMemoryShadowWriteAttempted: false,
      blockers: expect.arrayContaining(['explicit_shadow_confirmation_missing']),
    });
  });

  it('builds an in-memory shadow candidate after backup and dry run without cloud upload', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildCloudWriteShadowCandidate(input);

    expect(result).toMatchObject({
      id: 'phase21c-candidate-1',
      ok: true,
      status: 'shadow_candidate_ready',
      readyFor21D: true,
      blockers: [],
      userMessage: '查看后再继续',
      shadowCandidateReady: true,
      shadowCandidateAccepted: true,
      inMemoryShadowCandidateOnly: true,
      inMemoryShadowWriteAttempted: true,
      cloudWriteAttempted: false,
      cloudReadAttempted: false,
      requiresExplicitShadowConfirmation: true,
      requiresFirstUploadExplicitApply: true,
      requiresCloudReadMirrorBeforeApply: true,
      requiresConflictReviewBeforeApply: true,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      nextPhase: '21D - Cloud Read Mirror Verification V1',
      createdAt: nowIso,
      shadowVerification: {
        ok: true,
        status: 'accepted_shadow',
        applied: false,
        localDataChanged: false,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
        cloudPrimaryChanged: false,
      },
      shadowCandidate: {
        operationId: 'phase21c-operation-1',
        requestFingerprint: 'phase21c-request-1',
        accountId: 'account-1',
        ownerUserId: 'account-1',
        schemaVersion: emptyData().schemaVersion,
      },
    });
    expect(result.shadowCandidate.cloudIdempotencyKey).toContain('manual_push_candidate:cloud-account-candidate');
    expect(result.shadowCandidate.sourceSnapshotHash).toBe(result.shadowCandidate.targetSnapshotHash);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'shadow_candidate_only',
      'first_upload_confirmation_still_required',
      'cloud_read_mirror_still_required',
      'no_upload_performed',
      'no_cloud_write_performed',
      'localStorage_remains_fallback',
    ]));
    expect(input.appData).toEqual(before);
  });

  it('prevents duplicate shadow candidates before accepting another candidate', () => {
    const first = buildCloudWriteShadowCandidate(validInput());
    const duplicate = buildCloudWriteShadowCandidate(validInput({
      existingJournalEntries: first.shadowVerification?.journalEntry ? [first.shadowVerification.journalEntry] : [],
    }));

    expect(duplicate).toMatchObject({
      ok: false,
      status: 'duplicate_shadow_candidate',
      readyFor21D: false,
      shadowCandidateAccepted: false,
      inMemoryShadowWriteAttempted: false,
      blockers: expect.arrayContaining(['duplicate_shadow_candidate']),
      shadowVerification: {
        status: 'duplicate_shadow',
        shadowWriteAttempted: false,
      },
    });
  });

  it('fails closed on schema, conflict, and runtime boundary risks', () => {
    const schemaBlocked = buildCloudWriteShadowCandidate(validInput({
      schemaValidator: () => false,
    }));
    const conflictBlocked = buildCloudWriteShadowCandidate(validInput({
      cloudConflictDetected: true,
    }));
    const unsafe = buildCloudWriteShadowCandidate(validInput({
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
      readyFor21D: false,
      inMemoryShadowWriteAttempted: false,
      blockers: expect.arrayContaining(['schema_invalid']),
    });
    expect(conflictBlocked).toMatchObject({
      ok: false,
      status: 'cloud_conflict',
      readyFor21D: false,
      inMemoryShadowWriteAttempted: false,
      blockers: expect.arrayContaining(['cloud_conflict_detected']),
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21D: false,
      cloudWriteAttempted: false,
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
    const input = validInput({ candidateId: undefined });
    const before = JSON.parse(JSON.stringify(input));

    const first = buildCloudWriteShadowCandidate(input);
    const second = buildCloudWriteShadowCandidate(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
