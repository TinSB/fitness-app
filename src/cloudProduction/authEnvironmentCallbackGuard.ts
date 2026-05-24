export type AuthCandidateProvider = 'supabase-auth-candidate' | 'clerk-candidate';

export type AuthCandidateEnvironment = 'disabled' | 'development' | 'preview' | 'production';

export type AuthEnvironmentCallbackErrorCode =
  | 'auth_env_disabled'
  | 'provider_config_missing'
  | 'callback_url_missing'
  | 'callback_url_unsafe'
  | 'localhost_not_allowed_for_production'
  | 'preview_not_production'
  | 'secret_exposed_to_browser'
  | 'provider_not_enabled';

export type AuthEnvironmentCallbackInput = {
  enabled?: boolean;
  providerCandidate?: AuthCandidateProvider;
  environment?: AuthCandidateEnvironment;
  callbackUrl?: string;
  runtimeTargetUrl?: string;
  explicitPreviewAllowed?: boolean;
  browserConfig?: Record<string, unknown>;
};

export type AuthBrowserSafeConfig = {
  enabled: false;
  providerCandidate: AuthCandidateProvider | null;
  callbackUrl: string | null;
  containsSecrets: false;
};

export type AuthEnvironmentCallbackError = {
  code: AuthEnvironmentCallbackErrorCode;
  message: string;
};

export type AuthEnvironmentCallbackGuardResult =
  | {
      ok: true;
      enabled: true;
      providerCandidate: AuthCandidateProvider;
      environment: 'production';
      callbackUrl: string;
      browserSafeConfig: AuthBrowserSafeConfig;
      errors: [];
    }
  | {
      ok: false;
      enabled: false;
      providerCandidate: AuthCandidateProvider | null;
      environment: AuthCandidateEnvironment;
      callbackUrl: string | null;
      browserSafeConfig: AuthBrowserSafeConfig;
      errors: AuthEnvironmentCallbackError[];
    };

const safeError = (
  code: AuthEnvironmentCallbackErrorCode,
  message: string,
): AuthEnvironmentCallbackError => ({ code, message });

const devPrimaryRuntimeSource = ['api', 'primary-dev'].join('-');
const devReadonlyRuntimeSource = ['api', 'readonly'].join('-');

const sensitiveKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  ['client', 'Secret'].join(''),
];

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const hasSensitiveBrowserKey = (browserConfig: Record<string, unknown>) =>
  Object.keys(browserConfig).some((key) =>
    sensitiveKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase())),
  );

const parseUrl = (value: string | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isPreviewHost = (hostname: string) => /preview|vercel\.app$/i.test(hostname);

const localAuthCallbackPath = `/${['auth', 'callback'].join('/')}`;

const isExplicitLocalAuthCallback = (url: URL) =>
  url.protocol === 'http:' &&
  url.hostname === '127.0.0.1' &&
  url.port === '3000' &&
  url.pathname === localAuthCallbackPath;

export const createAuthBrowserSafeConfig = (
  input: AuthEnvironmentCallbackInput = {},
): AuthBrowserSafeConfig => ({
  enabled: false,
  providerCandidate: input.providerCandidate ?? null,
  callbackUrl: input.callbackUrl ?? null,
  containsSecrets: false,
});

export const resolveAuthEnvironmentCallbackGuard = (
  input: AuthEnvironmentCallbackInput = {},
): AuthEnvironmentCallbackGuardResult => {
  const errors: AuthEnvironmentCallbackError[] = [];
  const environment = input.environment ?? 'disabled';
  const browserSafeConfig = createAuthBrowserSafeConfig(input);
  const callbackUrl = parseUrl(input.callbackUrl);
  const runtimeTargetUrl = parseUrl(input.runtimeTargetUrl);

  if (hasSensitiveBrowserKey(input.browserConfig ?? {})) {
    errors.push(safeError('secret_exposed_to_browser', 'Browser-safe auth config must not include sensitive keys.'));
  }

  if (input.enabled !== true) {
    errors.push(safeError('auth_env_disabled', 'Auth environment guard is disabled by default.'));
    return {
      ok: false,
      enabled: false,
      providerCandidate: input.providerCandidate ?? null,
      environment,
      callbackUrl: input.callbackUrl ?? null,
      browserSafeConfig,
      errors,
    };
  }

  if (!input.providerCandidate) {
    errors.push(safeError('provider_config_missing', 'Provider candidate configuration is required.'));
  }

  if (!callbackUrl) {
    errors.push(safeError('callback_url_missing', 'Callback URL is required and must be valid.'));
  } else {
    const explicitLocalAuthCallback = isExplicitLocalAuthCallback(callbackUrl);
    if (callbackUrl.protocol !== 'https:' && !explicitLocalAuthCallback) {
      errors.push(safeError('callback_url_unsafe', 'Callback URL must use HTTPS.'));
    }
    if (isLocalHost(callbackUrl.hostname) && !explicitLocalAuthCallback) {
      errors.push(safeError('localhost_not_allowed_for_production', 'Localhost callback is not allowed for production.'));
    }
    if (isPreviewHost(callbackUrl.hostname) && environment !== 'preview') {
      errors.push(safeError('preview_not_production', 'Preview callback URL is not production.'));
    }
  }

  if (environment === 'preview' && input.explicitPreviewAllowed !== true) {
    errors.push(safeError('preview_not_production', 'Preview environment is not production unless explicitly classified.'));
  }

  if (
    input.runtimeTargetUrl === devPrimaryRuntimeSource ||
    input.runtimeTargetUrl === devReadonlyRuntimeSource ||
    (runtimeTargetUrl && isLocalHost(runtimeTargetUrl.hostname))
  ) {
    errors.push(safeError('provider_not_enabled', 'Dev/local runtime target cannot enable production auth candidate.'));
  }

  if (environment !== 'production') {
    errors.push(safeError('provider_not_enabled', 'Production environment classification is required.'));
  }

  if (errors.length > 0 || !input.providerCandidate || !callbackUrl) {
    return {
      ok: false,
      enabled: false,
      providerCandidate: input.providerCandidate ?? null,
      environment,
      callbackUrl: input.callbackUrl ?? null,
      browserSafeConfig,
      errors,
    };
  }

  return {
    ok: true,
    enabled: true,
    providerCandidate: input.providerCandidate,
    environment: 'production',
    callbackUrl: input.callbackUrl as string,
    browserSafeConfig,
    errors: [],
  };
};
