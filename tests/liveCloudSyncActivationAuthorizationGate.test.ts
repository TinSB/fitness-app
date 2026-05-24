import { describe, expect, it } from 'vitest';
import {
  buildLiveCloudSyncActivationAuthorizationGate,
  PHASE20A_AUTHORIZED_RUNTIME_SEQUENCE,
  PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID,
  type Phase20aLiveCloudSyncActivationAuthorizationInput,
} from '../src/cloudProduction/liveCloudSyncActivationAuthorizationGate';

const nowIso = '2026-05-24T10:00:00.000Z';

const phase19Acceptance = () => ({
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
});

const safetyConfirmation = () => ({
  manualActivationIntent: true,
  singleUserScopeConfirmed: true,
  localStorageFallbackConfirmed: true,
  noDefaultSyncConfirmed: true,
  noBackgroundWorkConfirmed: true,
  noSilentOverwriteConfirmed: true,
  noServiceRoleInBrowserConfirmed: true,
  noSaasScopeConfirmed: true,
  localBackupRequiredConfirmed: true,
  dryRunRequiredConfirmed: true,
});

const runtimeBoundary = () => ({
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  productionLaunchPerformed: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const validInput = (
  overrides: Partial<Phase20aLiveCloudSyncActivationAuthorizationInput> = {},
): Phase20aLiveCloudSyncActivationAuthorizationInput => ({
  enabled: true,
  phase19Acceptance: phase19Acceptance(),
  safetyConfirmation: safetyConfirmation(),
  runtimeBoundary: runtimeBoundary(),
  nowIso,
  authorizationId: 'phase20a-authorization-1',
  ...overrides,
});

describe('Phase 20A live cloud sync activation authorization gate', () => {
  it('is disabled by default and never activates runtime behavior', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate();

    expect(result).toMatchObject({
      baseId: PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID,
      phase: '20A',
      ok: false,
      status: 'disabled',
      runtimeImplementationAuthorized: false,
      canStart20B: false,
      authorizedPhases: [],
      blockers: expect.arrayContaining(['authorization_disabled']),
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      productionLaunchPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    });
  });

  it('authorizes the Phase 20 runtime sequence only when all evidence and confirmations are present', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildLiveCloudSyncActivationAuthorizationGate(input);

    expect(result).toMatchObject({
      id: 'phase20a-authorization-1',
      ok: true,
      status: 'authorized_for_runtime_sequence',
      runtimeImplementationAuthorized: true,
      canStart20B: true,
      phase19Accepted: true,
      safetyConfirmed: true,
      boundarySafe: true,
      requiresExplicitOptIn: true,
      requiresLocalBackupBeforeSync: true,
      requiresDryRunBeforeWrite: true,
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      productionLaunchPerformed: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      localStorageFallbackPreserved: true,
      nextPhase: '20B - Supabase Project Env & Runtime Readiness Check V1',
      createdAt: nowIso,
    });
    expect(result.authorizedPhases).toEqual([...PHASE20A_AUTHORIZED_RUNTIME_SEQUENCE]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'authorization_gate_only',
      'runtime_sequence_requires_separate_prs',
      'localStorage_remains_fallback',
      'manual_opt_in_required',
      'no_default_or_background_work',
    ]));
    expect(input).toEqual(before);
  });

  it('blocks when Phase 19 production manual acceptance evidence is missing', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate(validInput({
      phase19Acceptance: {
        ...phase19Acceptance(),
        manualAcceptancePassed: false,
        readyForFutureCloudPrimaryConsideration: false,
        validationAccepted: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase19_acceptance_missing',
      runtimeImplementationAuthorized: false,
      canStart20B: false,
      authorizedPhases: [],
      phase19Accepted: false,
      blockers: expect.arrayContaining([
        'phase19_manual_acceptance_missing',
        'phase19_future_consideration_missing',
        'phase19_validation_missing',
      ]),
    });
  });

  it('requires explicit single-user safety confirmations before runtime work can start', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate(validInput({
      safetyConfirmation: {
        ...safetyConfirmation(),
        manualActivationIntent: true,
        noDefaultSyncConfirmed: false,
        noSilentOverwriteConfirmed: false,
        localBackupRequiredConfirmed: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'safety_confirmation_missing',
      runtimeImplementationAuthorized: false,
      safetyConfirmed: false,
      blockers: expect.arrayContaining([
        'no_default_sync_missing',
        'no_silent_overwrite_missing',
        'local_backup_required_missing',
      ]),
    });
  });

  it('keeps manual activation intent as the first safety status when absent', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate(validInput({
      safetyConfirmation: {
        ...safetyConfirmation(),
        manualActivationIntent: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'activation_intent_missing',
      blockers: expect.arrayContaining(['manual_activation_intent_missing']),
    });
  });

  it('blocks unsafe existing runtime boundary evidence', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate(validInput({
      runtimeBoundary: {
        ...runtimeBoundary(),
        authRuntimeEnabled: true,
        syncRuntimeEnabled: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'boundary_unsafe',
      runtimeImplementationAuthorized: false,
      boundarySafe: false,
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'auth_runtime_already_enabled',
        'sync_runtime_already_enabled',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('blocks unsafe Phase 19 boundary evidence even when other confirmations are present', () => {
    const result = buildLiveCloudSyncActivationAuthorizationGate(validInput({
      phase19Acceptance: {
        ...phase19Acceptance(),
        productionLaunchPerformed: true,
        defaultSyncEnabled: true,
        sourceOfTruthChanged: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'boundary_unsafe',
      boundarySafe: false,
      blockers: expect.arrayContaining([
        'production_launch_performed',
        'default_sync_enabled',
        'source_of_truth_changed',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit authorization id is supplied', () => {
    const input = validInput({ authorizationId: undefined });

    const first = buildLiveCloudSyncActivationAuthorizationGate(input);
    const second = buildLiveCloudSyncActivationAuthorizationGate(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
