import { describe, expect, it } from 'vitest';
import {
  buildProductionAcceptanceSyntheticData,
  PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID,
  type Phase20hProductionAcceptanceSyntheticInput,
} from '../src/cloudProduction/productionAcceptanceSyntheticData';
import type { Phase20gConflictOfflineRollbackResult } from '../src/cloudProduction/conflictOfflineRollbackRuntimeFlow';

const nowIso = '2026-05-24T23:30:00.000Z';

const runtimeFlow = (
  overrides: Partial<Phase20gConflictOfflineRollbackResult> = {},
): Phase20gConflictOfflineRollbackResult => ({
  id: 'phase20g-flow-1',
  baseId: 'phase20g-conflict-offline-rollback-runtime-flow',
  phase: '20G',
  ok: true,
  status: 'ready_for_production_acceptance',
  readyFor20H: true,
  blockers: [],
  warnings: [],
  userMessage: '本地数据仍会保留',
  acceptance: {
    id: 'phase19k-acceptance-1',
    baseId: 'phase19k-conflict-offline-rollback-acceptance',
    phase: '19K',
    ok: true,
    status: 'acceptance_passed',
    acceptedForManualProductionReview: true,
    conflictReviewAccepted: true,
    offlineAccepted: true,
    rollbackAccepted: true,
    emergencyLocalAccepted: true,
    routeBoundaryAccepted: true,
    blockers: [],
    warnings: [],
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
  },
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
  ...overrides,
});

const validationEvidence = () => ({
  apiDevBuildPassed: true,
  typecheckPassed: true,
  testSuitePassed: true,
  productionBuildPassed: true,
  distTokenScanPassed: true,
  packageLockfileClean: true,
});

const manualEvidence = () => ({
  dedicatedEnvironment: true,
  dedicatedBrowserProfile: true,
  syntheticDataOnly: true,
  backupExportVerified: true,
  rlsOwnershipVerified: true,
  serviceRoleBlockedFromBrowser: true,
  privacyExportDeleteDocumented: true,
  offlineTrainingVerified: true,
  rollbackVerified: true,
  emergencyLocalVerified: true,
  routeLockVerified: true,
});

const productionBoundary = () => ({
  productionLaunchPerformed: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const validInput = (
  overrides: Partial<Phase20hProductionAcceptanceSyntheticInput> = {},
): Phase20hProductionAcceptanceSyntheticInput => ({
  enabled: true,
  runtimeFlow: runtimeFlow(),
  validationEvidence: validationEvidence(),
  manualEvidence: manualEvidence(),
  productionBoundary: productionBoundary(),
  nowIso,
  acceptanceId: 'phase20h-acceptance-1',
  ...overrides,
});

describe('Phase 20H production acceptance with synthetic data', () => {
  it('is disabled by default and does not launch production or change source of truth', () => {
    const result = buildProductionAcceptanceSyntheticData();

    expect(result).toMatchObject({
      baseId: PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID,
      phase: '20H',
      ok: false,
      status: 'disabled',
      readyFor20I: false,
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
        'acceptance_disabled',
        'phase20g_not_ready',
      ]),
    });
  });

  it('passes only with 20G readiness validation evidence and synthetic manual evidence', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildProductionAcceptanceSyntheticData(input);

    expect(result).toMatchObject({
      id: 'phase20h-acceptance-1',
      ok: true,
      status: 'accepted_for_ui_polish_handoff',
      readyFor20I: true,
      blockers: [],
      userMessage: '合成数据验收完成',
      validationAccepted: true,
      syntheticEvidenceAccepted: true,
      privacyAccepted: true,
      fallbackAccepted: true,
      routeBoundaryAccepted: true,
      cloudWriteCandidateAccepted: true,
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
      nextPhase: '20I - v0 UI Polish Handoff Contract V1',
      createdAt: nowIso,
      manualAcceptance: {
        ok: true,
        status: 'manual_acceptance_passed',
        manualAcceptancePassed: true,
      },
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'synthetic_acceptance_only',
      'no_real_personal_data',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
      'ui_polish_handoff_next',
    ]));
    expect(input).toEqual(before);
  });

  it('requires 20G runtime readiness', () => {
    const result = buildProductionAcceptanceSyntheticData(validInput({
      runtimeFlow: runtimeFlow({
        ok: false,
        readyFor20H: false,
        cloudWriteCandidateAccepted: false,
      }),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20g_not_ready',
      readyFor20I: false,
      blockers: expect.arrayContaining(['phase20g_not_ready']),
    });
  });

  it('requires local validation evidence', () => {
    const result = buildProductionAcceptanceSyntheticData(validInput({
      validationEvidence: {
        ...validationEvidence(),
        testSuitePassed: false,
        distTokenScanPassed: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'validation_missing',
      validationAccepted: false,
      blockers: expect.arrayContaining([
        'test_suite_missing',
        'dist_scan_missing',
      ]),
    });
  });

  it('requires synthetic manual evidence without real personal data', () => {
    const result = buildProductionAcceptanceSyntheticData(validInput({
      manualEvidence: {
        ...manualEvidence(),
        dedicatedEnvironment: false,
        dedicatedBrowserProfile: false,
        syntheticDataOnly: false,
        routeLockVerified: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'synthetic_evidence_missing',
      syntheticEvidenceAccepted: false,
      routeBoundaryAccepted: false,
      blockers: expect.arrayContaining([
        'dedicated_environment_missing',
        'dedicated_browser_profile_missing',
        'synthetic_data_missing',
        'route_lock_missing',
      ]),
    });
  });

  it('blocks production launch cloud primary default sync background work source switch and localStorage deletion', () => {
    const result = buildProductionAcceptanceSyntheticData(validInput({
      productionBoundary: {
        productionLaunchPerformed: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'production_boundary_unsafe',
      readyFor20I: false,
      productionLaunchPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'production_launch_performed',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit id is supplied', () => {
    const input = validInput({ acceptanceId: undefined });

    const first = buildProductionAcceptanceSyntheticData(input);
    const second = buildProductionAcceptanceSyntheticData(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
