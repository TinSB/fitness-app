export type AuthRuntimeStatus =
  | 'disabled'
  | 'unauthenticated'
  | 'provider_not_configured'
  | 'unsupported'
  | 'authenticated_candidate';

export type AuthRuntimeErrorCode =
  | 'auth_disabled'
  | 'provider_not_configured'
  | 'auth_not_implemented'
  | 'unsafe_environment'
  | 'session_unavailable';

export type AuthUser = {
  userId: string;
  accountId: string;
  displayName?: string;
};

export type AuthSession = {
  status: AuthRuntimeStatus;
  user: AuthUser | null;
  tokenPresent: false;
  secretsExposed: false;
};

export type AuthRuntimeResult = AuthSession & {
  ok: boolean;
  errorCode?: AuthRuntimeErrorCode;
  message: string;
};

export type AuthProviderAdapter = {
  readonly providerName: string;
  getSession: () => AuthRuntimeResult;
  login: () => AuthRuntimeResult;
  logout: () => AuthRuntimeResult;
};

export type AuthRuntimeSkeletonOptions = {
  enabled?: boolean;
  environmentSafe?: boolean;
  provider?: AuthProviderAdapter;
};

export type AuthRuntimeSkeleton = {
  status: AuthRuntimeStatus;
  providerName: string | null;
  enabled: boolean;
  providerConfigured: boolean;
  secretsExposed: false;
  getSession: () => AuthRuntimeResult;
  login: () => AuthRuntimeResult;
  logout: () => AuthRuntimeResult;
};

const result = (
  status: AuthRuntimeStatus,
  message: string,
  ok = false,
  errorCode?: AuthRuntimeErrorCode,
): AuthRuntimeResult => ({
  ok,
  status,
  user: null,
  tokenPresent: false,
  secretsExposed: false,
  errorCode,
  message,
});

export const createDisabledAuthProviderAdapter = (): AuthProviderAdapter => ({
  providerName: 'disabled-auth-adapter',
  getSession: () => result('disabled', 'Auth runtime is disabled by default.', false, 'auth_disabled'),
  login: () => result('unsupported', 'Login is not implemented in Phase 10.', false, 'auth_not_implemented'),
  logout: () => result('unsupported', 'Logout is not implemented in Phase 10.', false, 'auth_not_implemented'),
});

export const createAuthRuntimeSkeleton = (
  options: AuthRuntimeSkeletonOptions = {},
): AuthRuntimeSkeleton => {
  const enabled = options.enabled === true;
  const environmentSafe = options.environmentSafe !== false;
  const provider = options.provider;
  const disabledAdapter = createDisabledAuthProviderAdapter();

  if (!enabled) {
    return {
      status: 'disabled',
      providerName: null,
      enabled: false,
      providerConfigured: false,
      secretsExposed: false,
      getSession: disabledAdapter.getSession,
      login: disabledAdapter.login,
      logout: disabledAdapter.logout,
    };
  }

  if (!environmentSafe) {
    const unsafe = () => result('unsupported', 'Auth environment is unsafe.', false, 'unsafe_environment');
    return {
      status: 'unsupported',
      providerName: null,
      enabled: false,
      providerConfigured: false,
      secretsExposed: false,
      getSession: unsafe,
      login: unsafe,
      logout: unsafe,
    };
  }

  if (!provider) {
    const missingProvider = () => result(
      'provider_not_configured',
      'Auth provider is not configured in Phase 10.',
      false,
      'provider_not_configured',
    );
    return {
      status: 'provider_not_configured',
      providerName: null,
      enabled: false,
      providerConfigured: false,
      secretsExposed: false,
      getSession: missingProvider,
      login: missingProvider,
      logout: () => result('unauthenticated', 'No auth session exists to log out.', true),
    };
  }

  return {
    status: 'unauthenticated',
    providerName: provider.providerName,
    enabled: true,
    providerConfigured: true,
    secretsExposed: false,
    getSession: provider.getSession,
    login: provider.login,
    logout: provider.logout,
  };
};
