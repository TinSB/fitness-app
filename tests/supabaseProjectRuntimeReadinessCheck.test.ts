import { describe, expect, it } from 'vitest';
import {
  buildSupabaseProjectRuntimeReadinessCheck,
  PHASE20B_REQUIRED_BROWSER_ENV_KEYS,
  PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID,
  type Phase20bSupabaseProjectRuntimeReadinessInput,
} from '../src/cloudProduction/supabaseProjectRuntimeReadinessCheck';

const nowIso = '2026-05-24T12:00:00.000Z';

const phase20aAuthorization = () => ({
  runtimeImplementationAuthorized: true,
  canStart20B: true,
  liveCloudSyncActivated: false as const,
  authRuntimeEnabled: false as const,
  syncRuntimeEnabled: false as const,
  cloudPrimaryEnabled: false as const,
  defaultSyncEnabled: false as const,
  backgroundWorkEnabled: false as const,
  sourceOfTruthChanged: false as const,
  localStorageDeleted: false as const,
});

const browserEnv = () => ({
  VITE_SUPABASE_URL: 'https://ironpath-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
  VITE_IRONPATH_AUTH_CALLBACK_URL: 'https://app.ironpath.example/auth-callback',
  VITE_IRONPATH_CLOUD_ENVIRONMENT: 'production',
});

const runtimeBoundary = () => ({
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const validInput = (
  overrides: Partial<Phase20bSupabaseProjectRuntimeReadinessInput> = {},
): Phase20bSupabaseProjectRuntimeReadinessInput => ({
  enabled: true,
  phase20aAuthorization: phase20aAuthorization(),
  browserEnv: browserEnv(),
  runtimeBoundary: runtimeBoundary(),
  serviceRoleKeyPresent: false,
  browserConfig: { publicMode: 'runtime-readiness' },
  nowIso,
  readinessId: 'phase20b-readiness-1',
  ...overrides,
});

describe('Phase 20B Supabase project runtime readiness check', () => {
  it('is disabled by default and creates no client or runtime behavior', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck();

    expect(result).toMatchObject({
      baseId: PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID,
      phase: '20B',
      ok: false,
      status: 'disabled',
      readyFor20C: false,
      blockers: expect.arrayContaining(['readiness_disabled', 'phase20a_not_authorized']),
      clientCreated: false,
      networkAttempted: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      serviceRoleExposed: false,
      secretsExposed: false,
    });
  });

  it('reports exact missing browser env keys without reading real environment files', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck(validInput({
      browserEnv: {},
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'environment_missing',
      readyFor20C: false,
      missingBrowserEnvKeys: [...PHASE20B_REQUIRED_BROWSER_ENV_KEYS],
      blockers: expect.arrayContaining([
        'project_url_missing',
        'anon_key_missing',
        'auth_callback_url_missing',
        'cloud_environment_missing',
      ]),
      clientCreated: false,
      networkAttempted: false,
    });
  });

  it('passes readiness with synthetic production-safe public config while keeping runtime off', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildSupabaseProjectRuntimeReadinessCheck(input);

    expect(result).toMatchObject({
      id: 'phase20b-readiness-1',
      ok: true,
      status: 'ready_for_auth_runtime_wiring',
      readyFor20C: true,
      missingBrowserEnvKeys: [],
      browserSafeConfigReady: true,
      clientCreated: false,
      networkAttempted: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      localStorageFallbackPreserved: true,
      serviceRoleExposed: false,
      secretsExposed: false,
      nextPhase: '20C - Auth Runtime Wiring V1',
      createdAt: nowIso,
    });
    expect(result.projectGuard.ok).toBe(true);
    expect(result.authCallbackGuard.ok).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'readiness_check_only',
      'no_client_created',
      'no_network_request',
      'localStorage_remains_fallback',
      'manual_opt_in_still_required',
    ]));
    expect(input).toEqual(before);
  });

  it('requires Phase 20A authorization before 20C can start', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck(validInput({
      phase20aAuthorization: {
        ...phase20aAuthorization(),
        runtimeImplementationAuthorized: false,
        canStart20B: false,
        liveCloudSyncActivated: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20a_authorization_missing',
      readyFor20C: false,
      blockers: expect.arrayContaining(['phase20a_not_authorized', 'live_sync_already_active']),
    });
  });

  it('rejects service role presence and secret-like browser config', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck(validInput({
      serviceRoleKeyPresent: true,
      browserConfig: {
        publicMode: 'runtime-readiness',
        serviceRoleValue: 'synthetic-secret-value',
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'service_role_risk',
      readyFor20C: false,
      serviceRoleExposed: false,
      secretsExposed: false,
      blockers: expect.arrayContaining([
        'service_role_browser_risk',
        'secret_like_browser_config',
      ]),
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('rejects non-production localhost or preview project and callback config', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck(validInput({
      browserEnv: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
        VITE_IRONPATH_AUTH_CALLBACK_URL: 'http://localhost:5173/auth-callback',
        VITE_IRONPATH_CLOUD_ENVIRONMENT: 'development',
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      readyFor20C: false,
      blockers: expect.arrayContaining([
        'project_url_invalid',
        'auth_callback_url_unsafe',
        'localhost_callback_rejected',
        'cloud_environment_not_production',
        'project_guard_rejected',
        'auth_callback_guard_rejected',
      ]),
    });
  });

  it('blocks if runtime boundary evidence is already unsafe', () => {
    const result = buildSupabaseProjectRuntimeReadinessCheck(validInput({
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
      status: 'runtime_boundary_unsafe',
      readyFor20C: false,
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

  it('uses deterministic ids when nowIso is fixed and no explicit readiness id is supplied', () => {
    const input = validInput({ readinessId: undefined });

    const first = buildSupabaseProjectRuntimeReadinessCheck(input);
    const second = buildSupabaseProjectRuntimeReadinessCheck(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
