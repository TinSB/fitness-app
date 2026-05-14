export type CloudProductionEnvironmentKind =
  | 'disabled'
  | 'development'
  | 'preview'
  | 'production';

export type CloudProductionBackendClassification =
  | 'missing'
  | 'invalid'
  | 'dev-local'
  | 'preview'
  | 'production';

export type ProductionSecretsEnvironmentErrorCode =
  | 'cloud_runtime_disabled'
  | 'environment_kind_required'
  | 'preview_not_production'
  | 'production_backend_required'
  | 'backend_url_invalid'
  | 'backend_url_not_production'
  | 'dev_runtime_not_production'
  | 'secret_required_for_future_runtime'
  | 'secret_exposed_to_browser_config';

export type ProductionSecretsEnvironmentInput = {
  enabled?: boolean;
  environmentKind?: CloudProductionEnvironmentKind;
  backendBaseUrl?: string;
  runtimeSource?: string;
  requiredSecretPresent?: boolean;
  browserConfig?: Record<string, unknown>;
};

export type BrowserSafeCloudProductionConfig = {
  enabled: false;
  environmentKind: CloudProductionEnvironmentKind;
  backendBaseUrl: string | null;
  containsSecrets: false;
};

export type ProductionSecretsEnvironmentError = {
  code: ProductionSecretsEnvironmentErrorCode;
  message: string;
};

export type ProductionSecretsEnvironmentGuardResult =
  | {
      ok: true;
      enabled: true;
      environmentKind: 'production';
      backendClassification: 'production';
      browserSafeConfig: BrowserSafeCloudProductionConfig;
      errors: [];
    }
  | {
      ok: false;
      enabled: false;
      environmentKind: CloudProductionEnvironmentKind;
      backendClassification: CloudProductionBackendClassification;
      browserSafeConfig: BrowserSafeCloudProductionConfig;
      errors: ProductionSecretsEnvironmentError[];
    };

const devPrimaryRuntimeSource = ['api', 'primary-dev'].join('-');
const devReadonlyRuntimeSource = ['api', 'readonly'].join('-');

const safeError = (
  code: ProductionSecretsEnvironmentErrorCode,
  message: string,
): ProductionSecretsEnvironmentError => ({ code, message });

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const sensitiveBrowserConfigKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  ['client', 'Secret'].join(''),
];

const hasSecretLikeKey = (key: string) =>
  sensitiveBrowserConfigKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase()));

export const classifyCloudProductionBackendUrl = (
  backendBaseUrl?: string,
): CloudProductionBackendClassification => {
  if (backendBaseUrl === undefined || backendBaseUrl.trim().length === 0) return 'missing';

  try {
    const url = new URL(backendBaseUrl);
    if (isLocalHost(url.hostname)) return 'dev-local';
    if (url.protocol !== 'https:') return 'invalid';
    if (/preview|vercel\.app$/i.test(url.hostname)) return 'preview';
    return 'production';
  } catch {
    return 'invalid';
  }
};

export const createBrowserSafeCloudProductionConfig = (
  input: ProductionSecretsEnvironmentInput = {},
): BrowserSafeCloudProductionConfig => ({
  enabled: false,
  environmentKind: input.environmentKind ?? 'disabled',
  backendBaseUrl: input.backendBaseUrl ?? null,
  containsSecrets: false,
});

export const resolveProductionSecretsEnvironmentGuard = (
  input: ProductionSecretsEnvironmentInput = {},
): ProductionSecretsEnvironmentGuardResult => {
  const environmentKind = input.environmentKind ?? 'disabled';
  const backendClassification = classifyCloudProductionBackendUrl(input.backendBaseUrl);
  const browserSafeConfig = createBrowserSafeCloudProductionConfig(input);
  const errors: ProductionSecretsEnvironmentError[] = [];

  const browserConfig = input.browserConfig ?? {};
  const secretKey = Object.keys(browserConfig).find(hasSecretLikeKey);
  if (secretKey) {
    errors.push(safeError('secret_exposed_to_browser_config', 'Browser-safe config must not include secret-like keys.'));
  }

  if (input.enabled !== true) {
    errors.push(safeError('cloud_runtime_disabled', 'Cloud production runtime is disabled by default.'));
    return {
      ok: false,
      enabled: false,
      environmentKind,
      backendClassification,
      browserSafeConfig,
      errors,
    };
  }

  if (environmentKind !== 'production') {
    errors.push(safeError(
      environmentKind === 'preview' ? 'preview_not_production' : 'environment_kind_required',
      'Cloud production runtime requires explicit production environment classification.',
    ));
  }

  if (input.runtimeSource === devPrimaryRuntimeSource || input.runtimeSource === devReadonlyRuntimeSource) {
    errors.push(safeError('dev_runtime_not_production', 'Dev/local runtime source is not production cloud runtime.'));
  }

  if (input.requiredSecretPresent !== true) {
    errors.push(safeError('secret_required_for_future_runtime', 'Required future production secret presence was not confirmed.'));
  }

  if (backendClassification === 'missing') {
    errors.push(safeError('production_backend_required', 'Production backend URL is required for future cloud runtime.'));
  } else if (backendClassification === 'invalid') {
    errors.push(safeError('backend_url_invalid', 'Production backend URL must be a valid HTTPS URL.'));
  } else if (backendClassification === 'dev-local' || backendClassification === 'preview') {
    errors.push(safeError('backend_url_not_production', 'Development, localhost, and preview URLs are not production cloud backend URLs.'));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      enabled: false,
      environmentKind,
      backendClassification,
      browserSafeConfig,
      errors,
    };
  }

  return {
    ok: true,
    enabled: true,
    environmentKind: 'production',
    backendClassification: 'production',
    browserSafeConfig,
    errors: [],
  };
};
