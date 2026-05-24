import { describe, expect, it } from 'vitest';
import {
  buildPhase19jExplicitOptInSingleUserSyncCandidate,
  PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID,
  type Phase19jExplicitOptInSyncCandidateInput,
} from '../src/cloudProduction/explicitOptInSingleUserSyncCandidate';

const nowIso = '2026-05-24T03:00:00.000Z';

const migrationDryRun = () => ({
  readyForShadowCandidate: true,
  noUpload: true,
  noDownload: true,
  localDataChanged: false,
  cloudDataChanged: false,
  sourceOfTruthChanged: false,
  blockers: [],
});

const readMirror = () => ({
  status: 'cloud_missing',
  requiresManualReview: false,
  applied: false,
  localDataChanged: false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
});

const writeShadow = () => ({
  ok: true,
  status: 'accepted_shadow',
  shadowWriteAttempted: true,
  localDataChanged: false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  cloudPrimaryChanged: false,
});

const validInput = (
  overrides: Partial<Phase19jExplicitOptInSyncCandidateInput> = {},
): Phase19jExplicitOptInSyncCandidateInput => ({
  enabled: true,
  explicitOptIn: true,
  manualConfirmation: true,
  accountReady: true,
  backupAvailable: true,
  cloudAvailable: true,
  ownerVerified: true,
  schemaVerified: true,
  rollbackAvailable: true,
  offlineTrainingAvailable: true,
  migrationDryRun: migrationDryRun(),
  readMirror: readMirror(),
  writeShadow: writeShadow(),
  conflictPreflight: {
    conflictDetected: false,
    manualResolutionRequired: false,
    severity: 'info',
    conflictType: 'cloud_missing',
  },
  nowIso,
  syncCandidateId: 'sync-candidate-phase19j-1',
  ...overrides,
});

describe('Phase 19J explicit opt-in single-user sync candidate', () => {
  it('is disabled by default and never uploads downloads applies or changes source of truth', () => {
    const result = buildPhase19jExplicitOptInSingleUserSyncCandidate();

    expect(result).toMatchObject({
      baseId: PHASE19J_EXPLICIT_OPT_IN_SYNC_CANDIDATE_ID,
      phase: '19J',
      ok: false,
      status: 'disabled',
      readyForManualSyncCandidate: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageFallbackPreserved: true,
      blockers: expect.arrayContaining(['sync_disabled']),
    });
  });

  it('creates an explicit manual sync candidate when every safety gate is ready', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildPhase19jExplicitOptInSingleUserSyncCandidate(input);

    expect(result).toMatchObject({
      id: 'sync-candidate-phase19j-1',
      ok: true,
      status: 'candidate_ready',
      readyForManualSyncCandidate: true,
      requiresManualConflictReview: false,
      uploadPerformed: false,
      downloadPerformed: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      noAutomaticWorker: true,
      localStorageFallbackPreserved: true,
      offlineTrainingAvailable: true,
      blockers: [],
      candidate: {
        syncMode: 'manual_explicit_opt_in',
        dryRunReady: true,
        shadowAccepted: true,
        readMirrorStatus: 'cloud_missing',
        requiresSeparateApplyStep: true,
        nextReview: '19K - Conflict / Offline / Rollback Acceptance V1',
      },
      nextPhase: '19K - Conflict / Offline / Rollback Acceptance V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'manual_sync_only',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
      'no_background_sync',
      'review_before_final_step',
    ]));
    expect(input).toEqual(before);
  });

  it('requires explicit opt-in manual confirmation account readiness and 19I dry-run readiness', () => {
    const result = buildPhase19jExplicitOptInSingleUserSyncCandidate(validInput({
      explicitOptIn: false,
      manualConfirmation: false,
      accountReady: false,
      migrationDryRun: {
        ...migrationDryRun(),
        readyForShadowCandidate: false,
        blockers: ['backup_missing'],
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      readyForManualSyncCandidate: false,
      blockers: expect.arrayContaining([
        'explicit_opt_in_missing',
        'manual_confirmation_missing',
        'account_not_ready',
        'migration_dry_run_not_ready',
      ]),
      candidate: {
        dryRunReady: false,
      },
    });
  });

  it('blocks missing backup cloud rollback owner schema and offline readiness without fake success', () => {
    const result = buildPhase19jExplicitOptInSingleUserSyncCandidate(validInput({
      backupAvailable: false,
      cloudAvailable: false,
      rollbackAvailable: false,
      ownerVerified: false,
      schemaVerified: false,
      offlineTrainingAvailable: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      sourceOfTruthChanged: false,
      offlineTrainingAvailable: false,
      blockers: expect.arrayContaining([
        'backup_missing',
        'cloud_unavailable',
        'rollback_unavailable',
        'owner_not_verified',
        'schema_not_verified',
        'offline_unavailable',
      ]),
    });
  });

  it('requires accepted write shadow evidence before manual sync candidate is ready', () => {
    const result = buildPhase19jExplicitOptInSingleUserSyncCandidate(validInput({
      writeShadow: {
        ...writeShadow(),
        ok: false,
        status: 'dry_run_missing',
        shadowWriteAttempted: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'shadow_candidate_missing',
      readyForManualSyncCandidate: false,
      blockers: expect.arrayContaining(['shadow_candidate_missing']),
      candidate: {
        shadowAccepted: false,
        writeShadowStatus: 'dry_run_missing',
      },
    });
  });

  it('requires manual conflict review for mirror differences or blocking conflict preflight', () => {
    const review = buildPhase19jExplicitOptInSingleUserSyncCandidate(validInput({
      readMirror: {
        ...readMirror(),
        status: 'review_required',
        requiresManualReview: true,
      },
      conflictPreflight: {
        conflictDetected: true,
        manualResolutionRequired: true,
        severity: 'blocking',
        conflictType: 'both_changed',
      },
      manualConflictReviewed: false,
    }));

    expect(review).toMatchObject({
      ok: false,
      status: 'conflict_review_required',
      requiresManualConflictReview: true,
      blockers: expect.arrayContaining(['conflict_review_required']),
      candidate: {
        conflictType: 'both_changed',
        readMirrorStatus: 'review_required',
      },
    });

    const reviewed = buildPhase19jExplicitOptInSingleUserSyncCandidate(validInput({
      readMirror: {
        ...readMirror(),
        status: 'review_required',
        requiresManualReview: true,
      },
      conflictPreflight: {
        conflictDetected: true,
        manualResolutionRequired: true,
        severity: 'blocking',
        conflictType: 'both_changed',
      },
      manualConflictReviewed: true,
    }));

    expect(reviewed).toMatchObject({
      ok: true,
      status: 'candidate_ready',
      requiresManualConflictReview: false,
      candidate: {
        conflictReviewed: true,
      },
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit candidate id is supplied', () => {
    const input = validInput({ syncCandidateId: undefined });

    const first = buildPhase19jExplicitOptInSingleUserSyncCandidate(input);
    const second = buildPhase19jExplicitOptInSingleUserSyncCandidate(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
