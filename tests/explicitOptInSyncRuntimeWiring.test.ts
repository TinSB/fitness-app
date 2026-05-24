import { describe, expect, it } from 'vitest';
import {
  buildExplicitOptInSyncRuntimeWiring,
  PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID,
  type Phase20dAuthRuntimeLike,
  type Phase20dExplicitOptInSyncRuntimeInput,
} from '../src/cloudProduction/explicitOptInSyncRuntimeWiring';

const nowIso = '2026-05-24T20:00:00.000Z';

const authRuntime = (): Phase20dAuthRuntimeLike => ({
  readyFor20D: true,
  authRuntimeEnabled: true,
  authenticated: true,
  user: {
    userId: 'user-1',
    accountId: 'account-1',
    displayName: 'Local User',
  },
  tokenStored: false,
  localStorageChanged: false,
  secretsExposed: false,
  serviceRoleExposed: false,
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const runtimeBoundary = () => ({
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const validInput = (
  overrides: Partial<Phase20dExplicitOptInSyncRuntimeInput> = {},
): Phase20dExplicitOptInSyncRuntimeInput => ({
  enabled: true,
  authRuntime: authRuntime(),
  explicitOptIn: true,
  manualConfirmation: true,
  localStorageFallbackConfirmed: true,
  noSilentOverwriteConfirmed: true,
  backupBeforeSyncConfirmed: true,
  runtimeBoundary: runtimeBoundary(),
  nowIso,
  wiringId: 'phase20d-sync-runtime-1',
  ...overrides,
});

describe('Phase 20D explicit opt-in sync runtime wiring', () => {
  it('is disabled by default and does not upload download or change source of truth', () => {
    const result = buildExplicitOptInSyncRuntimeWiring();

    expect(result).toMatchObject({
      baseId: PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID,
      phase: '20D',
      ok: false,
      status: 'disabled',
      readyFor20E: false,
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
      blockers: expect.arrayContaining([
        'sync_wiring_disabled',
        'auth_runtime_not_ready',
        'authenticated_user_missing',
      ]),
    });
  });

  it('wires sync runtime only after auth evidence explicit opt-in and safety confirmations', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildExplicitOptInSyncRuntimeWiring(input);

    expect(result).toMatchObject({
      id: 'phase20d-sync-runtime-1',
      ok: true,
      status: 'sync_runtime_wired',
      readyFor20E: true,
      user: authRuntime().user,
      blockers: [],
      userMessage: '开启前先备份',
      explicitOptInAccepted: true,
      manualConfirmationAccepted: true,
      localStorageFallbackConfirmed: true,
      noSilentOverwriteConfirmed: true,
      backupBeforeSyncConfirmed: true,
      authRuntimeEnabled: true,
      syncRuntimeEnabled: true,
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
      requiresBackupBeforeFirstSync: true,
      requiresDryRunBeforeFirstWrite: true,
      requiresConflictReviewBeforeApply: true,
      nextPhase: '20E - Local Backup + Dry-Run Migration Runtime Flow V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'manual_sync_only',
      'backup_required_before_first_sync',
      'dry_run_required_before_first_write',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
      'no_background_sync',
      'no_upload_or_download',
    ]));
    expect(input).toEqual(before);
  });

  it('requires 20C auth readiness and an authenticated account user', () => {
    const result = buildExplicitOptInSyncRuntimeWiring(validInput({
      authRuntime: {
        ...authRuntime(),
        readyFor20D: false,
        authenticated: false,
        user: null,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'auth_not_ready',
      readyFor20E: false,
      syncRuntimeEnabled: false,
      user: null,
      blockers: expect.arrayContaining([
        'auth_runtime_not_ready',
        'authenticated_user_missing',
      ]),
    });
  });

  it('requires explicit opt-in manual confirmation and local safety acknowledgements', () => {
    const result = buildExplicitOptInSyncRuntimeWiring(validInput({
      explicitOptIn: false,
      manualConfirmation: false,
      localStorageFallbackConfirmed: false,
      noSilentOverwriteConfirmed: false,
      backupBeforeSyncConfirmed: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'opt_in_missing',
      readyFor20E: false,
      syncRuntimeEnabled: false,
      blockers: expect.arrayContaining([
        'explicit_opt_in_missing',
        'manual_confirmation_missing',
        'localStorage_fallback_not_confirmed',
        'no_silent_overwrite_not_confirmed',
        'backup_before_sync_not_confirmed',
      ]),
    });
  });

  it('fails closed when runtime evidence is already unsafe', () => {
    const result = buildExplicitOptInSyncRuntimeWiring(validInput({
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
      readyFor20E: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'sync_runtime_already_enabled',
        'live_sync_already_active',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('fails closed when auth evidence reports token storage secrets or localStorage mutation', () => {
    const result = buildExplicitOptInSyncRuntimeWiring(validInput({
      authRuntime: {
        ...authRuntime(),
        tokenStored: true,
        localStorageChanged: true,
        secretsExposed: true,
        serviceRoleExposed: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      syncRuntimeEnabled: false,
      blockers: expect.arrayContaining([
        'auth_token_storage_detected',
        'auth_localStorage_changed',
        'auth_secret_exposed',
        'auth_service_role_exposed',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit id is supplied', () => {
    const input = validInput({ wiringId: undefined });

    const first = buildExplicitOptInSyncRuntimeWiring(input);
    const second = buildExplicitOptInSyncRuntimeWiring(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
