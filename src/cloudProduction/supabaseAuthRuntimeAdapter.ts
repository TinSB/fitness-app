import { createClient, type SupabaseClient, type SupabaseClientOptions, type User } from '@supabase/supabase-js';
import {
  buildAuthRuntimeWiring,
  type Phase20cAuthAction,
  type Phase20cAuthAdapterResult,
  type Phase20cAuthRuntimeAdapter,
  type Phase20cAuthRuntimeWiringResult,
  type Phase20cReadinessLike,
} from './authRuntimeWiring';

export type SupabaseAuthRuntimePublicConfig = {
  supabaseUrl?: string;
  anonKey?: string;
  authCallbackUrl?: string;
  cloudEnvironment?: string;
};

export type SupabaseAuthRuntimeClient = Pick<SupabaseClient, 'auth'>;

export type SupabaseAuthRuntimeClientFactory = (
  supabaseUrl: string,
  anonKey: string,
  options: SupabaseClientOptions<'public'>,
) => SupabaseAuthRuntimeClient;

export type SupabaseAuthRuntimeActionInput = {
  action: Phase20cAuthAction;
  readiness?: Phase20cReadinessLike | null;
  publicConfig?: SupabaseAuthRuntimePublicConfig | null;
  signInEmail?: string | null;
  password?: string | null;
  userInitiated?: boolean;
  nowIso?: string;
  currentUrl?: string;
  clientFactory?: SupabaseAuthRuntimeClientFactory;
};

const safeRuntimeBoundary = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const trimValue = (value: string | undefined | null) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const normalizeEmail = (value: string | undefined | null) => {
  const trimmed = trimValue(value);
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
};

const safeAdapterResult = (
  status: Phase20cAuthAdapterResult['status'],
  options: {
    ok?: boolean;
    user?: Phase20cAuthAdapterResult['user'];
    message?: string;
    networkAttempted?: boolean;
    localStorageChanged?: boolean;
    secretsExposed?: boolean;
  } = {},
): Phase20cAuthAdapterResult => ({
  ok: options.ok ?? false,
  status,
  user: options.user ?? null,
  message: options.message ?? 'Supabase auth action did not complete.',
  networkAttempted: options.networkAttempted ?? false,
  tokenStored: false,
  localStorageChanged: options.localStorageChanged ?? false,
  secretsExposed: options.secretsExposed ?? false,
});

const fixedResultAdapter = (adapterResult: Phase20cAuthAdapterResult): Phase20cAuthRuntimeAdapter => ({
  providerName: 'supabase-auth-runtime',
  checkSession: () => adapterResult,
  signIn: () => adapterResult,
  signUp: () => adapterResult,
  signOut: () => adapterResult,
});

const finalizeAuthRuntime = (
  input: SupabaseAuthRuntimeActionInput,
  adapterResult: Phase20cAuthAdapterResult,
): Phase20cAuthRuntimeWiringResult =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: input.readiness ?? null,
    adapter: fixedResultAdapter(adapterResult),
    action: input.action,
    userInitiated: input.userInitiated === true,
    runtimeBoundary: safeRuntimeBoundary,
    nowIso: input.nowIso,
  });

const getBrowserHref = () => {
  if (typeof window === 'undefined') return null;
  return window.location.href;
};

const parseUrl = (value: string | undefined | null) => {
  const normalized = trimValue(value);
  if (!normalized) return null;
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
};

const isAuthCallbackUrl = (callbackUrl: string | undefined | null, currentUrl: string | undefined | null) => {
  const callback = parseUrl(callbackUrl);
  const current = parseUrl(currentUrl);
  if (!callback || !current) return false;
  return current.origin === callback.origin && current.pathname === callback.pathname;
};

const hasAuthCallbackSignal = (
  callbackUrl: string | undefined | null,
  currentUrl: string | undefined | null,
) => {
  const current = parseUrl(currentUrl);
  if (!current || !isAuthCallbackUrl(callbackUrl, current.href)) return false;
  const hashParams = new URLSearchParams(current.hash.replace(/^#/, ''));
  return Boolean(
    current.searchParams.get('code') ||
      current.searchParams.get('error') ||
      hashParams.get('access_token') ||
      hashParams.get('error_description'),
  );
};

const localStorageSignature = () => {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    const keys = Array.from({ length: globalThis.localStorage.length }, (_, index) =>
      globalThis.localStorage.key(index),
    ).filter((key): key is string => Boolean(key));
    return keys.sort().join('|');
  } catch {
    return null;
  }
};

const userFromSupabase = (user: User | null | undefined): Phase20cAuthAdapterResult['user'] => {
  if (!user?.id) return null;
  const accountId = user.email || user.phone || user.id;
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
  return {
    userId: user.id,
    accountId,
    displayName: user.email || metadataName || accountId,
  };
};

const normalizePassword = (value: string | undefined | null) => {
  const trimmed = trimValue(value);
  return trimmed ?? null;
};

const createSupabaseAuthClient = (
  config: Required<SupabaseAuthRuntimePublicConfig>,
  currentUrl: string | null,
  clientFactory: SupabaseAuthRuntimeClientFactory = createClient,
) =>
  clientFactory(config.supabaseUrl, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: (url, params) =>
        isAuthCallbackUrl(config.authCallbackUrl, url.href) &&
        Boolean(params.access_token || params.error_description || params.error || params.code),
      flowType: 'implicit',
      storageKey: 'ironpath-auth-memory-only',
    },
    global: {
      headers: {
        'x-ironpath-auth-runtime': hasAuthCallbackSignal(config.authCallbackUrl, currentUrl)
          ? 'callback'
          : 'settings',
      },
    },
  });

const normalizeConfig = (
  publicConfig: SupabaseAuthRuntimePublicConfig | null | undefined,
): Required<SupabaseAuthRuntimePublicConfig> | null => {
  const supabaseUrl = trimValue(publicConfig?.supabaseUrl);
  const anonKey = trimValue(publicConfig?.anonKey);
  const authCallbackUrl = trimValue(publicConfig?.authCallbackUrl);
  const cloudEnvironment = trimValue(publicConfig?.cloudEnvironment);
  if (!supabaseUrl || !anonKey || !authCallbackUrl || cloudEnvironment !== 'production') return null;
  return { supabaseUrl, anonKey, authCallbackUrl, cloudEnvironment };
};

export const runSupabaseAuthRuntimeAction = async (
  input: SupabaseAuthRuntimeActionInput,
): Promise<Phase20cAuthRuntimeWiringResult> => {
  const readiness = input.readiness ?? null;
  const config = normalizeConfig(input.publicConfig);

  if (readiness?.readyFor20C !== true || !config) {
    return finalizeAuthRuntime(input, safeAdapterResult('unsupported', {
      message: 'Supabase auth runtime config is not ready.',
    }));
  }

  if ((input.action === 'sign_in' || input.action === 'sign_up' || input.action === 'sign_out') && input.userInitiated !== true) {
    return finalizeAuthRuntime(input, safeAdapterResult('unsupported', {
      message: 'Supabase auth action requires explicit user action.',
    }));
  }

  const email = normalizeEmail(input.signInEmail);
  if ((input.action === 'sign_in' || input.action === 'sign_up') && !email) {
    return finalizeAuthRuntime(input, safeAdapterResult('unsupported', {
      message: 'Email is required before Supabase email/password auth.',
    }));
  }

  const password = normalizePassword(input.password);
  if ((input.action === 'sign_in' || input.action === 'sign_up') && !password) {
    return finalizeAuthRuntime(input, safeAdapterResult('unsupported', {
      message: 'Password is required before Supabase email/password auth.',
    }));
  }

  const beforeStorage = localStorageSignature();
  const currentUrl = input.currentUrl ?? getBrowserHref();
  const client = createSupabaseAuthClient(config, currentUrl, input.clientFactory);
  const callbackNetworkLikely = hasAuthCallbackSignal(config.authCallbackUrl, currentUrl);

  try {
    if (input.action === 'sign_in') {
      const response = await client.auth.signInWithPassword({
        email: email as string,
        password: password as string,
      });
      const changed = beforeStorage !== localStorageSignature();
      if (response.error) {
        return finalizeAuthRuntime(input, safeAdapterResult('failed', {
          message: 'Supabase sign-in failed.',
          networkAttempted: true,
          localStorageChanged: changed,
        }));
      }
      const user = userFromSupabase(response.data.user);
      return finalizeAuthRuntime(input, safeAdapterResult(user ? 'authenticated' : 'unauthenticated', {
        ok: true,
        user,
        message: user ? 'Supabase password sign-in completed.' : 'Supabase password sign-in returned no user.',
        networkAttempted: true,
        localStorageChanged: changed,
      }));
    }

    if (input.action === 'sign_up') {
      const response = await client.auth.signUp({
        email: email as string,
        password: password as string,
      });
      const changed = beforeStorage !== localStorageSignature();
      if (response.error) {
        return finalizeAuthRuntime(input, safeAdapterResult('failed', {
          message: 'Supabase sign-up failed.',
          networkAttempted: true,
          localStorageChanged: changed,
        }));
      }
      const user = userFromSupabase(response.data.user);
      return finalizeAuthRuntime(input, safeAdapterResult(user ? 'authenticated' : 'unauthenticated', {
        ok: true,
        user,
        message: user ? 'Supabase account was created.' : 'Supabase sign-up returned no user.',
        networkAttempted: true,
        localStorageChanged: changed,
      }));
    }

    if (input.action === 'sign_out') {
      const response = await client.auth.signOut({ scope: 'local' });
      const changed = beforeStorage !== localStorageSignature();
      if (response.error) {
        return finalizeAuthRuntime(input, safeAdapterResult('failed', {
          message: 'Supabase sign-out failed.',
          networkAttempted: true,
          localStorageChanged: changed,
        }));
      }
      return finalizeAuthRuntime(input, safeAdapterResult('signed_out', {
        ok: true,
        message: 'Supabase sign-out completed.',
        networkAttempted: true,
        localStorageChanged: changed,
      }));
    }

    const response = await client.auth.getSession();
    const changed = beforeStorage !== localStorageSignature();
    if (response.error) {
      return finalizeAuthRuntime(input, safeAdapterResult('failed', {
        message: 'Supabase session check failed.',
        networkAttempted: callbackNetworkLikely,
        localStorageChanged: changed,
      }));
    }

    const user = userFromSupabase(response.data.session?.user);
    return finalizeAuthRuntime(input, safeAdapterResult(user ? 'authenticated' : 'unauthenticated', {
      ok: true,
      user,
      message: user ? 'Supabase session is available.' : 'Supabase session is empty.',
      networkAttempted: callbackNetworkLikely,
      localStorageChanged: changed,
    }));
  } catch {
    return finalizeAuthRuntime(input, safeAdapterResult('failed', {
      message: 'Supabase auth action failed safely.',
      networkAttempted: input.action !== 'check_session' || callbackNetworkLikely,
      localStorageChanged: beforeStorage !== localStorageSignature(),
    }));
  }
};
