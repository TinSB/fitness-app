import { describe, expect, it } from 'vitest';
import {
  buildAuthRuntimeWiring,
  createSyntheticAuthRuntimeAdapter,
  PHASE20C_AUTH_RUNTIME_WIRING_ID,
  type Phase20cAuthRuntimeAdapter,
  type Phase20cAuthRuntimeWiringInput,
} from '../src/cloudProduction/authRuntimeWiring';

const nowIso = '2026-05-24T14:00:00.000Z';

const readiness = () => ({
  readyFor20C: true,
  missingBrowserEnvKeys: [],
  clientCreated: false,
  networkAttempted: false,
  serviceRoleExposed: false,
  secretsExposed: false,
  authRuntimeEnabled: false,
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

const user = () => ({
  userId: 'synthetic-user-1',
  accountId: 'synthetic-account-1',
  displayName: 'Synthetic User',
});

const validInput = (
  overrides: Partial<Phase20cAuthRuntimeWiringInput> = {},
): Phase20cAuthRuntimeWiringInput => ({
  enabled: true,
  readiness: readiness(),
  adapter: createSyntheticAuthRuntimeAdapter(user()),
  action: 'check_session',
  runtimeBoundary: runtimeBoundary(),
  nowIso,
  wiringId: 'phase20c-auth-wiring-1',
  ...overrides,
});

describe('Phase 20C auth runtime wiring', () => {
  it('is disabled by default and keeps every durable boundary off', () => {
    const result = buildAuthRuntimeWiring();

    expect(result).toMatchObject({
      baseId: PHASE20C_AUTH_RUNTIME_WIRING_ID,
      phase: '20C',
      ok: false,
      status: 'disabled',
      readyFor20D: false,
      blockers: expect.arrayContaining(['auth_wiring_disabled', 'phase20b_not_ready', 'auth_adapter_missing']),
      authRuntimeEnabled: false,
      authenticated: false,
      clientCreated: false,
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      secretsExposed: false,
      serviceRoleExposed: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
    });
  });

  it('blocks when 20B readiness is missing or reports missing env keys', () => {
    const result = buildAuthRuntimeWiring(validInput({
      readiness: {
        ...readiness(),
        readyFor20C: false,
        missingBrowserEnvKeys: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'readiness_missing',
      readyFor20D: false,
      blockers: expect.arrayContaining(['phase20b_not_ready', 'phase20b_missing_env']),
      authRuntimeEnabled: false,
    });
  });

  it('requires an injected adapter and does not create a provider internally', () => {
    const result = buildAuthRuntimeWiring(validInput({ adapter: null }));

    expect(result).toMatchObject({
      ok: false,
      status: 'adapter_missing',
      providerName: null,
      sessionChecked: false,
      blockers: expect.arrayContaining(['auth_adapter_missing']),
      clientCreated: false,
      networkAttempted: false,
    });
  });

  it('checks an existing session through a safe adapter without storing tokens', () => {
    const input = validInput();
    const before = {
      ...input,
      adapter: input.adapter,
      readiness: input.readiness ? {
        ...input.readiness,
        missingBrowserEnvKeys: [...(input.readiness.missingBrowserEnvKeys ?? [])],
      } : input.readiness,
      runtimeBoundary: input.runtimeBoundary ? { ...input.runtimeBoundary } : input.runtimeBoundary,
    };

    const result = buildAuthRuntimeWiring(input);

    expect(result).toMatchObject({
      id: 'phase20c-auth-wiring-1',
      ok: true,
      status: 'session_checked',
      action: 'check_session',
      providerName: 'synthetic-auth-runtime',
      user: user(),
      readyFor20D: true,
      authRuntimeEnabled: true,
      authenticated: true,
      sessionChecked: true,
      userActionRequired: false,
      clientCreated: false,
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      networkAttempted: false,
      secretsExposed: false,
      serviceRoleExposed: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageFallbackPreserved: true,
      nextPhase: '20D - Explicit Opt-In Sync Runtime Wiring V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'auth_runtime_wiring_only',
      'manual_user_action_required',
      'tokens_not_stored',
      'sync_still_off',
      'localStorage_remains_fallback',
    ]));
    expect(input).toEqual(before);
  });

  it('requires explicit user action before sign-in or sign-out is attempted', () => {
    const result = buildAuthRuntimeWiring(validInput({
      action: 'sign_in',
      userInitiated: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'user_action_required',
      action: 'sign_in',
      userActionRequired: true,
      sessionChecked: false,
      blockers: expect.arrayContaining(['user_action_missing']),
      authRuntimeEnabled: false,
    });
  });

  it('signs in and signs out through the injected adapter only after user action', () => {
    const signedIn = buildAuthRuntimeWiring(validInput({
      action: 'sign_in',
      userInitiated: true,
    }));
    const signedOut = buildAuthRuntimeWiring(validInput({
      action: 'sign_out',
      userInitiated: true,
    }));

    expect(signedIn).toMatchObject({
      ok: true,
      status: 'signed_in',
      authenticated: true,
      user: user(),
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
    });
    expect(signedOut).toMatchObject({
      ok: true,
      status: 'signed_out',
      authenticated: false,
      user: null,
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
    });
  });

  it('keeps unauthenticated session checks successful but not ready for sync wiring', () => {
    const result = buildAuthRuntimeWiring(validInput({
      adapter: createSyntheticAuthRuntimeAdapter(null),
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'session_checked',
      authenticated: false,
      user: null,
      readyFor20D: false,
      authRuntimeEnabled: true,
      tokenStored: false,
      localStorageChanged: false,
    });
  });

  it('fails closed on adapter token storage secret exposure or localStorage mutation', () => {
    const unsafeAdapter: Phase20cAuthRuntimeAdapter = {
      providerName: 'synthetic-auth-runtime',
      checkSession: () => ({
        ok: true,
        status: 'authenticated',
        user: user(),
        message: 'Unsafe adapter result.',
        networkAttempted: false,
        tokenStored: true,
        localStorageChanged: true,
        secretsExposed: true,
      }),
      signIn: () => ({
        ok: false,
        status: 'failed',
        user: null,
        message: 'Unused.',
        networkAttempted: false,
        tokenStored: false,
        localStorageChanged: false,
        secretsExposed: false,
      }),
      signOut: () => ({
        ok: false,
        status: 'failed',
        user: null,
        message: 'Unused.',
        networkAttempted: false,
        tokenStored: false,
        localStorageChanged: false,
        secretsExposed: false,
      }),
    };

    const result = buildAuthRuntimeWiring(validInput({ adapter: unsafeAdapter }));

    expect(result).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor20D: false,
      authenticated: false,
      tokenStored: false,
      localStorageChanged: false,
      secretsExposed: false,
      authRuntimeEnabled: false,
      blockers: expect.arrayContaining([
        'adapter_token_storage_detected',
        'adapter_secret_exposed',
        'adapter_localStorage_changed',
      ]),
    });
  });

  it('blocks if runtime evidence already enabled sync cloud-primary or source changes', () => {
    const result = buildAuthRuntimeWiring(validInput({
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

  it('uses deterministic ids when nowIso is fixed and no explicit wiring id is supplied', () => {
    const input = validInput({ wiringId: undefined });

    const first = buildAuthRuntimeWiring(input);
    const second = buildAuthRuntimeWiring(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
