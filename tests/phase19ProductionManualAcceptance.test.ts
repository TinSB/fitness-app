import { describe, expect, it } from 'vitest';
import {
  buildPhase19ProductionManualAcceptance,
  PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID,
  type Phase19ProductionManualAcceptanceInput,
} from '../src/cloudProduction/phase19ProductionManualAcceptance';

const nowIso = '2026-05-24T05:00:00.000Z';

const phase19kAcceptance = () => ({
  acceptedForManualProductionReview: true,
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
});

const validInput = (
  overrides: Partial<Phase19ProductionManualAcceptanceInput> = {},
): Phase19ProductionManualAcceptanceInput => ({
  enabled: true,
  phase19kAcceptance: phase19kAcceptance(),
  validationEvidence: validationEvidence(),
  manualEvidence: manualEvidence(),
  productionBoundary: productionBoundary(),
  nowIso,
  acceptanceId: 'phase19l-manual-acceptance-1',
  ...overrides,
});

describe('Phase 19L production manual acceptance', () => {
  it('is disabled by default and never launches production or changes source of truth', () => {
    const result = buildPhase19ProductionManualAcceptance();

    expect(result).toMatchObject({
      baseId: PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID,
      phase: '19L',
      ok: false,
      status: 'disabled',
      manualAcceptancePassed: false,
      readyForFutureCloudPrimaryConsideration: false,
      productionLaunchPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      blockers: expect.arrayContaining(['manual_acceptance_disabled']),
    });
  });

  it('passes manual acceptance when all evidence is present while keeping production disabled', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildPhase19ProductionManualAcceptance(input);

    expect(result).toMatchObject({
      id: 'phase19l-manual-acceptance-1',
      ok: true,
      status: 'manual_acceptance_passed',
      manualAcceptancePassed: true,
      readyForFutureCloudPrimaryConsideration: true,
      validationAccepted: true,
      privacyAccepted: true,
      fallbackAccepted: true,
      routeBoundaryAccepted: true,
      productionLaunchPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      blockers: [],
      finalPhaseComplete: true,
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'manual_acceptance_only',
      'future_cloud_primary_requires_separate_decision',
      'localStorage_remains_fallback',
      'no_real_personal_data',
    ]));
    expect(input).toEqual(before);
  });

  it('requires Phase 19K acceptance evidence to be safe', () => {
    const result = buildPhase19ProductionManualAcceptance(validInput({
      phase19kAcceptance: {
        ...phase19kAcceptance(),
        acceptedForManualProductionReview: false,
        uploadPerformed: true,
        sourceOfTruthChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase19k_acceptance_missing',
      manualAcceptancePassed: false,
      blockers: expect.arrayContaining([
        'phase19k_acceptance_missing',
        'upload_performed',
        'source_of_truth_changed',
      ]),
    });
  });

  it('requires all local validation gates before manual acceptance can pass', () => {
    const result = buildPhase19ProductionManualAcceptance(validInput({
      validationEvidence: {
        apiDevBuildPassed: false,
        typecheckPassed: false,
        testSuitePassed: false,
        productionBuildPassed: false,
        distTokenScanPassed: false,
        packageLockfileClean: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'validation_missing',
      validationAccepted: false,
      blockers: expect.arrayContaining([
        'api_dev_build_missing',
        'typecheck_missing',
        'test_suite_missing',
        'production_build_missing',
        'dist_scan_missing',
        'package_lockfile_drift',
      ]),
    });
  });

  it('requires dedicated synthetic privacy ownership rollback and route evidence', () => {
    const result = buildPhase19ProductionManualAcceptance(validInput({
      manualEvidence: {
        dedicatedEnvironment: false,
        dedicatedBrowserProfile: false,
        syntheticDataOnly: false,
        backupExportVerified: false,
        rlsOwnershipVerified: false,
        serviceRoleBlockedFromBrowser: false,
        privacyExportDeleteDocumented: false,
        offlineTrainingVerified: false,
        rollbackVerified: false,
        emergencyLocalVerified: false,
        routeLockVerified: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_evidence_missing',
      privacyAccepted: false,
      fallbackAccepted: false,
      routeBoundaryAccepted: false,
      blockers: expect.arrayContaining([
        'dedicated_environment_missing',
        'dedicated_browser_profile_missing',
        'synthetic_data_missing',
        'backup_export_missing',
        'rls_ownership_missing',
        'service_role_boundary_missing',
        'privacy_export_delete_missing',
        'offline_training_missing',
        'rollback_missing',
        'emergency_local_missing',
        'route_lock_missing',
      ]),
    });
  });

  it('blocks production launch cloud primary default sync background work and source switch', () => {
    const result = buildPhase19ProductionManualAcceptance(validInput({
      productionBoundary: {
        productionLaunchPerformed: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'production_boundary_unsafe',
      readyForFutureCloudPrimaryConsideration: false,
      blockers: expect.arrayContaining([
        'production_launch_performed',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit acceptance id is supplied', () => {
    const input = validInput({ acceptanceId: undefined });

    const first = buildPhase19ProductionManualAcceptance(input);
    const second = buildPhase19ProductionManualAcceptance(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
