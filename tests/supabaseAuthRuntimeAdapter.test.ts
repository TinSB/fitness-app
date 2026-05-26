import { describe, expect, it } from 'vitest';
import {
  runSupabaseAuthRuntimeAction,
  type SupabaseAuthRuntimeClient,
  type SupabaseAuthRuntimeClientFactory,
} from '../src/cloudProduction/supabaseAuthRuntimeAdapter';

const nowIso = '2026-05-25T10:00:00.000Z';

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

const publicConfig = () => ({
  supabaseUrl: 'https://ironpath-project.supabase.co',
  anonKey: 'synthetic-public-anon-key',
  authCallbackUrl: 'http://127.0.0.1:3000/auth/callback',
  cloudEnvironment: 'production',
});

const supabaseUser = () => ({
  id: 'supabase-user-1',
  email: 'person@example.test',
  phone: '',
  user_metadata: {},
});

const makeClientFactory = (auth: Partial<SupabaseAuthRuntimeClient['auth']>) => {
  const calls: Array<{
    supabaseUrl: string;
    anonKey: string;
    options: Parameters<SupabaseAuthRuntimeClientFactory>[2];
  }> = [];
  const factory: SupabaseAuthRuntimeClientFactory = (supabaseUrl, anonKey, options) => {
    calls.push({ supabaseUrl, anonKey, options });
    return { auth } as unknown as SupabaseAuthRuntimeClient;
  };
  return { factory, calls };
};

describe('real Supabase auth runtime adapter', () => {
  it('checks a Supabase session through the Phase 20C contract without enabling sync or storing tokens', async () => {
    const { factory, calls } = makeClientFactory({
      getSession: async () => ({
        data: { session: { user: supabaseUser() } },
        error: null,
      }),
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'check_session',
      readiness: readiness(),
      publicConfig: publicConfig(),
      userInitiated: false,
      nowIso,
      clientFactory: factory,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      supabaseUrl: 'https://ironpath-project.supabase.co',
      anonKey: 'synthetic-public-anon-key',
    });
    expect(calls[0].options.auth).toMatchObject({
      autoRefreshToken: true,
      persistSession: true,
      flowType: 'implicit',
      storageKey: 'ironpath-auth-session-v1',
    });
    expect(typeof calls[0].options.auth?.detectSessionInUrl).toBe('function');
    expect(result).toMatchObject({
      ok: true,
      status: 'session_checked',
      providerName: 'supabase-auth-runtime',
      authenticated: true,
      user: {
        userId: 'supabase-user-1',
        accountId: 'supabase-user-1',
        displayName: 'person@example.test',
      },
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      serviceRoleExposed: false,
      secretsExposed: false,
    });
  });

  it('signs in with email and password without using magic links or enabling sync', async () => {
    let passwordInput: unknown = null;
    const { factory } = makeClientFactory({
      signInWithOtp: async () => {
        throw new Error('magic link sign-in should not be used');
      },
      signInWithPassword: async (input: unknown) => {
        passwordInput = input;
        return { data: { user: supabaseUser(), session: null }, error: null };
      },
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'sign_in',
      readiness: readiness(),
      publicConfig: publicConfig(),
      signInEmail: 'person@example.test',
      password: 'strong-password',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });

    expect(passwordInput).toEqual({
      email: 'person@example.test',
      password: 'strong-password',
    });
    expect(result).toMatchObject({
      ok: true,
      action: 'sign_in',
      status: 'signed_in',
      authenticated: true,
      user: {
        userId: 'supabase-user-1',
        accountId: 'supabase-user-1',
        displayName: 'person@example.test',
      },
      networkAttempted: true,
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
    });
  });

  it('creates an account with email and password without enabling sync', async () => {
    let signUpInput: unknown = null;
    const { factory } = makeClientFactory({
      signInWithOtp: async () => {
        throw new Error('magic link sign-in should not be used');
      },
      signUp: async (input: unknown) => {
        signUpInput = input;
        return { data: { user: supabaseUser(), session: null }, error: null };
      },
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'sign_up',
      readiness: readiness(),
      publicConfig: publicConfig(),
      signInEmail: 'person@example.test',
      password: 'strong-password',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });

    expect(signUpInput).toEqual({
      email: 'person@example.test',
      password: 'strong-password',
    });
    expect(result).toMatchObject({
      ok: true,
      action: 'sign_up',
      status: 'signed_in',
      authenticated: true,
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
    });
  });

  it('fails closed before network access when email or password is invalid', async () => {
    const factory: SupabaseAuthRuntimeClientFactory = () => {
      throw new Error('client should not be created');
    };

    const invalidEmail = await runSupabaseAuthRuntimeAction({
      action: 'sign_in',
      readiness: readiness(),
      publicConfig: publicConfig(),
      signInEmail: 'not-an-email',
      password: 'strong-password',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });
    const missingPassword = await runSupabaseAuthRuntimeAction({
      action: 'sign_in',
      readiness: readiness(),
      publicConfig: publicConfig(),
      signInEmail: 'person@example.test',
      password: '',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });

    expect(invalidEmail.status).toBe('adapter_failed');
    expect(invalidEmail.networkAttempted).toBe(false);
    expect(missingPassword.status).toBe('adapter_failed');
    expect(missingPassword.networkAttempted).toBe(false);
  });

  it('signs out only the local Supabase browser session through explicit user action', async () => {
    let signOutInput: unknown = null;
    const { factory } = makeClientFactory({
      signOut: async (input: unknown) => {
        signOutInput = input;
        return { error: null };
      },
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'sign_out',
      readiness: readiness(),
      publicConfig: publicConfig(),
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });

    expect(signOutInput).toEqual({ scope: 'local' });
    expect(result).toMatchObject({
      ok: true,
      status: 'signed_out',
      authenticated: false,
      networkAttempted: true,
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
    });
  });

  it('does not create a Supabase client when readiness or public config is unsafe', async () => {
    const factory: SupabaseAuthRuntimeClientFactory = () => {
      throw new Error('client should not be created');
    };

    const notReady = await runSupabaseAuthRuntimeAction({
      action: 'check_session',
      readiness: {
        ...readiness(),
        readyFor20C: false,
        missingBrowserEnvKeys: ['VITE_SUPABASE_URL'],
      },
      publicConfig: publicConfig(),
      userInitiated: false,
      nowIso,
      clientFactory: factory,
    });
    const missingConfig = await runSupabaseAuthRuntimeAction({
      action: 'sign_in',
      readiness: readiness(),
      publicConfig: { ...publicConfig(), anonKey: undefined },
      signInEmail: 'person@example.test',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });

    expect(notReady.status).toBe('readiness_missing');
    expect(notReady.blockers).toEqual(expect.arrayContaining(['phase20b_not_ready', 'phase20b_missing_env']));
    expect(missingConfig.status).toBe('adapter_failed');
    expect(missingConfig.networkAttempted).toBe(false);
  });

  it('fails closed if the Supabase auth operation changes localStorage', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() {
          return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    });

    try {
      const { factory } = makeClientFactory({
        signInWithPassword: async () => {
          globalThis.localStorage.setItem('supabase-token', 'redacted');
          return { data: { user: supabaseUser(), session: null }, error: null };
        },
      });

      const result = await runSupabaseAuthRuntimeAction({
        action: 'sign_in',
        readiness: readiness(),
        publicConfig: publicConfig(),
        signInEmail: 'person@example.test',
        password: 'strong-password',
        userInitiated: true,
        nowIso,
        clientFactory: factory,
      });

      expect(result.status).toBe('runtime_boundary_unsafe');
      expect(result.blockers).toContain('adapter_localStorage_changed');
      expect(result.localStorageChanged).toBe(false);
      expect(result.syncRuntimeEnabled).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it('does not serialize public env values or token-like values in the auth runtime result', async () => {
    const { factory } = makeClientFactory({
      signInWithPassword: async () => ({ data: { user: supabaseUser(), session: null }, error: null }),
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'sign_in',
      readiness: readiness(),
      publicConfig: publicConfig(),
      signInEmail: 'person@example.test',
      password: 'strong-password',
      userInitiated: true,
      nowIso,
      clientFactory: factory,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('https://ironpath-project.supabase.co');
    expect(serialized).not.toContain('synthetic-public-anon-key');
    expect(serialized).not.toContain('strong-password');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE');
  });

  it('treats a configured auth callback URL as the only session-check network boundary', async () => {
    const { factory } = makeClientFactory({
      getSession: async () => ({
        data: { session: { user: supabaseUser() } },
        error: null,
      }),
    });

    const result = await runSupabaseAuthRuntimeAction({
      action: 'check_session',
      readiness: readiness(),
      publicConfig: publicConfig(),
      userInitiated: false,
      nowIso,
      currentUrl: 'http://127.0.0.1:3000/auth/callback#access_token=redacted-token',
      clientFactory: factory,
    });

    expect(result).toMatchObject({
      ok: true,
      authenticated: true,
      networkAttempted: true,
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain('redacted-token');
  });
});
