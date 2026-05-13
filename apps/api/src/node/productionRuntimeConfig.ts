export type ProductionRuntimeConfigInput = {
  enabled?: boolean;
  runtimeKind?: string;
  backendBaseUrl?: string;
  containsSecretValues?: boolean;
};

export type ProductionRuntimeConfigErrorCode =
  | 'production_runtime_disabled'
  | 'production_runtime_kind_required'
  | 'api_primary_dev_not_production'
  | 'dev_local_runtime_not_production'
  | 'backend_base_url_required'
  | 'backend_base_url_invalid'
  | 'backend_base_url_not_production'
  | 'secret_values_not_allowed';

export type ProductionRuntimeConfigError = {
  code: ProductionRuntimeConfigErrorCode;
  message: string;
};

export type ProductionRuntimeConfigResult =
  | {
    ok: true;
    enabled: true;
    runtimeKind: 'production-runtime';
    backendBaseUrl: string;
    backendBaseUrlClassification: 'production';
    errors: [];
  }
  | {
    ok: false;
    enabled: false;
    runtimeKind: 'disabled' | 'invalid';
    backendBaseUrlClassification: 'missing' | 'invalid' | 'dev-local' | 'production';
    errors: ProductionRuntimeConfigError[];
  };

const safeError = (code: ProductionRuntimeConfigErrorCode, message: string): ProductionRuntimeConfigError => ({
  code,
  message,
});

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

export const classifyProductionBackendBaseUrl = (
  backendBaseUrl?: string,
): ProductionRuntimeConfigResult['backendBaseUrlClassification'] => {
  if (backendBaseUrl === undefined || backendBaseUrl.trim().length === 0) return 'missing';

  try {
    const url = new URL(backendBaseUrl);
    if (url.protocol !== 'https:') return isLocalHost(url.hostname) ? 'dev-local' : 'invalid';
    if (isLocalHost(url.hostname)) return 'dev-local';
    return 'production';
  } catch {
    return 'invalid';
  }
};

export const resolveProductionRuntimeConfig = (
  input: ProductionRuntimeConfigInput = {},
): ProductionRuntimeConfigResult => {
  const errors: ProductionRuntimeConfigError[] = [];

  if (input.containsSecretValues) {
    errors.push(safeError('secret_values_not_allowed', 'Secret values must not be supplied to production runtime config guard.'));
  }

  if (input.enabled !== true) {
    errors.push(safeError('production_runtime_disabled', 'Production runtime is disabled by default.'));
    return {
      ok: false,
      enabled: false,
      runtimeKind: 'disabled',
      backendBaseUrlClassification: classifyProductionBackendBaseUrl(input.backendBaseUrl),
      errors,
    };
  }

  if (input.runtimeKind !== 'production-runtime') {
    if (input.runtimeKind === 'api-primary-dev') {
      errors.push(safeError('api_primary_dev_not_production', 'api-primary-dev is explicit dev/local only.'));
    } else if (input.runtimeKind === 'dev-api' || input.runtimeKind === 'dev-local') {
      errors.push(safeError('dev_local_runtime_not_production', 'Dev/local runtime kind is not a production runtime.'));
    } else {
      errors.push(safeError('production_runtime_kind_required', 'Production runtime kind must be explicit.'));
    }
  }

  const backendBaseUrlClassification = classifyProductionBackendBaseUrl(input.backendBaseUrl);
  if (backendBaseUrlClassification === 'missing') {
    errors.push(safeError('backend_base_url_required', 'Production backend base URL is required when runtime is enabled.'));
  } else if (backendBaseUrlClassification === 'invalid') {
    errors.push(safeError('backend_base_url_invalid', 'Production backend base URL must be a valid HTTPS URL.'));
  } else if (backendBaseUrlClassification === 'dev-local') {
    errors.push(safeError('backend_base_url_not_production', 'Localhost and dev API URLs are not production backend URLs.'));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      enabled: false,
      runtimeKind: 'invalid',
      backendBaseUrlClassification,
      errors,
    };
  }

  return {
    ok: true,
    enabled: true,
    runtimeKind: 'production-runtime',
    backendBaseUrl: input.backendBaseUrl as string,
    backendBaseUrlClassification: 'production',
    errors: [],
  };
};
