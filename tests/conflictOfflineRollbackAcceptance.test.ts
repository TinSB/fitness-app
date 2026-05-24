import { describe, expect, it } from 'vitest';
import {
  buildPhase19kConflictOfflineRollbackAcceptance,
  PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID,
  type Phase19kConflictOfflineRollbackAcceptanceInput,
} from '../src/cloudProduction/conflictOfflineRollbackAcceptance';

const nowIso = '2026-05-24T04:00:00.000Z';

const syncCandidate = () => ({
  readyForManualSyncCandidate: true,
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
});

const conflictReview = () => ({
  reviewed: true,
  manualResolutionRequired: true,
  canAutoApply: false,
  conflictType: 'both_changed',
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
  overrides: Partial<Phase19kConflictOfflineRollbackAcceptanceInput> = {},
): Phase19kConflictOfflineRollbackAcceptanceInput => ({
  enabled: true,
  syncCandidate: syncCandidate(),
  conflictReview: conflictReview(),
  offlineProof: offlineProof(),
  rollbackProof: rollbackProof(),
  boundaryProof: boundaryProof(),
  nowIso,
  acceptanceId: 'phase19k-acceptance-1',
  ...overrides,
});

describe('Phase 19K conflict offline rollback acceptance', () => {
  it('is disabled by default and never performs sync or changes source of truth', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance();

    expect(result).toMatchObject({
      baseId: PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID,
      phase: '19K',
      ok: false,
      status: 'disabled',
      acceptedForManualProductionReview: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      blockers: expect.arrayContaining(['acceptance_disabled']),
    });
  });

  it('passes acceptance when sync conflict offline rollback and boundary proofs are safe', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildPhase19kConflictOfflineRollbackAcceptance(input);

    expect(result).toMatchObject({
      id: 'phase19k-acceptance-1',
      ok: true,
      status: 'acceptance_passed',
      acceptedForManualProductionReview: true,
      conflictReviewAccepted: true,
      offlineAccepted: true,
      rollbackAccepted: true,
      emergencyLocalAccepted: true,
      routeBoundaryAccepted: true,
      blockers: [],
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
      nextPhase: '19L - Production Manual Acceptance V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'acceptance_only',
      'manual_production_review_required',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
    ]));
    expect(input).toEqual(before);
  });

  it('blocks unsafe or missing 19J sync candidate proof', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance(validInput({
      syncCandidate: {
        ...syncCandidate(),
        readyForManualSyncCandidate: false,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'sync_candidate_not_ready',
      acceptedForManualProductionReview: false,
      blockers: expect.arrayContaining([
        'sync_candidate_not_ready',
        'source_of_truth_changed',
        'default_sync_enabled',
        'background_work_enabled',
      ]),
    });
  });

  it('requires reviewed manual conflict handling and rejects auto apply capability', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance(validInput({
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
      conflictReviewAccepted: false,
      blockers: expect.arrayContaining([
        'conflict_review_missing',
        'auto_apply_available',
      ]),
    });
  });

  it('requires offline training no-fake-success and disabled background work', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance(validInput({
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
      offlineAccepted: false,
      blockers: expect.arrayContaining([
        'offline_training_unavailable',
        'background_work_not_disabled',
        'fake_success_possible',
        'cloud_unavailable_blocks_training',
      ]),
    });
  });

  it('requires rollback fallback and emergency local availability without local deletion', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance(validInput({
      rollbackProof: {
        rollbackAvailable: false,
        emergencyLocalAvailable: false,
        fallbackLocalStorageAvailable: false,
        localDataDeleted: true,
        sourceOfTruthChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'rollback_unavailable',
      rollbackAccepted: false,
      emergencyLocalAccepted: false,
      blockers: expect.arrayContaining([
        'rollback_unavailable',
        'emergency_local_unavailable',
        'fallback_localStorage_unavailable',
        'local_data_deleted',
        'source_of_truth_changed',
      ]),
    });
  });

  it('keeps route package and schema boundary drift blocked', () => {
    const result = buildPhase19kConflictOfflineRollbackAcceptance(validInput({
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

  it('uses deterministic ids when nowIso is fixed and no explicit acceptance id is supplied', () => {
    const input = validInput({ acceptanceId: undefined });

    const first = buildPhase19kConflictOfflineRollbackAcceptance(input);
    const second = buildPhase19kConflictOfflineRollbackAcceptance(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
