import { describe, expect, it } from 'vitest';
import { buildAuthRuntimeWiring, createSyntheticAuthRuntimeAdapter } from '../src/cloudProduction/authRuntimeWiring';
import { buildExplicitOptInSyncPreflight } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { buildSupabaseProjectRuntimeReadinessCheck } from '../src/cloudProduction/supabaseProjectRuntimeReadinessCheck';

const nowIso = '2026-05-25T12:00:00.000Z';

const ready20b = () =>
  buildSupabaseProjectRuntimeReadinessCheck({
    enabled: true,
    phase20aAuthorization: {
      runtimeImplementationAuthorized: true,
      canStart20B: true,
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    browserEnv: {
      VITE_SUPABASE_URL: 'https://ironpath-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
      VITE_IRONPATH_AUTH_CALLBACK_URL: 'https://fitness-app-wheat-phi.vercel.app/auth/callback',
      VITE_IRONPATH_CLOUD_ENVIRONMENT: 'production',
    },
    runtimeBoundary: {
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    serviceRoleKeyPresent: false,
    browserConfig: { publicBrowserConfigOnly: true },
    nowIso,
  });

const signedInAuth = () =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: ready20b(),
    adapter: createSyntheticAuthRuntimeAdapter({
      userId: 'user-1',
      accountId: 'account-1',
      displayName: 'ironpath@example.test',
    }),
    action: 'check_session',
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

describe('Phase 21A explicit opt-in sync preflight', () => {
  it('is disabled by default and never moves data', () => {
    const result = buildExplicitOptInSyncPreflight();

    expect(result).toMatchObject({
      phase: '21A',
      ok: false,
      status: 'disabled',
      readyFor21B: false,
      syncPreflightVisible: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining(['preflight_disabled']),
    });
  });

  it('passes preflight only with public readiness and signed-in account evidence', () => {
    const result = buildExplicitOptInSyncPreflight({
      enabled: true,
      readiness: ready20b(),
      authRuntime: signedInAuth(),
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
      preflightId: 'phase21a-preflight-1',
    });

    expect(result).toMatchObject({
      id: 'phase21a-preflight-1',
      ok: true,
      status: 'ready_for_backup_dry_run',
      readyFor21B: true,
      syncPreflightVisible: true,
      userMessage: '本地数据仍会保留',
      primaryActionLabel: '检查本地数据',
      secondaryActionLabels: ['开启前先备份', '查看将同步的内容'],
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      nextPhase: '21B - Local Backup Dry Run UI V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'manual_opt_in_required',
      'backup_required_before_first_upload',
      'dry_run_required_before_first_upload',
      'localStorage_remains_fallback',
      'no_default_sync',
      'no_background_sync',
    ]));
  });

  it('requires sign-in before backup and dry-run can start', () => {
    const result = buildExplicitOptInSyncPreflight({
      enabled: true,
      readiness: ready20b(),
      authRuntime: null,
      nowIso,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'sign_in_required',
      readyFor21B: false,
      syncPreflightVisible: true,
      blockers: expect.arrayContaining(['auth_runtime_not_ready', 'authenticated_user_missing']),
      syncRuntimeEnabled: false,
    });
  });

  it('fails closed on unsafe runtime evidence without enabling sync', () => {
    const result = buildExplicitOptInSyncPreflight({
      enabled: true,
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      runtimeBoundary: {
        syncRuntimeEnabled: true,
        liveCloudSyncActivated: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
      nowIso,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21B: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
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

  it('uses deterministic ids and does not mutate inputs', () => {
    const input = {
      enabled: true,
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      nowIso,
    };
    const before = JSON.parse(JSON.stringify(input));

    const first = buildExplicitOptInSyncPreflight(input);
    const second = buildExplicitOptInSyncPreflight(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
