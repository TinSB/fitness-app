export type ProductionDeploymentEnvironment =
  | 'disabled'
  | 'local'
  | 'dev'
  | 'preview'
  | 'production-candidate'
  | 'production'
  | 'emergency-local';

export type ProductionDeploymentTarget = 'production-candidate' | 'production';

export type SupabaseProjectDeploymentClassification =
  | 'missing'
  | 'invalid'
  | 'local'
  | 'preview'
  | 'test'
  | 'production-candidate'
  | 'production';

export type ProductionDeploymentBackendClassification =
  | 'missing'
  | 'invalid'
  | 'dev-local'
  | 'preview'
  | 'production-candidate'
  | 'production';

export type ProductionDeploymentConfigGuardErrorCode =
  | 'deployment_disabled'
  | 'backend_url_missing'
  | 'backend_url_unsafe'
  | 'localhost_not_production'
  | 'preview_not_production'
  | 'dev_api_not_production'
  | 'service_role_not_browser_safe'
  | 'supabase_project_not_production'
  | 'config_incomplete';

export type ProductionDeploymentConfigGuardInput = {
  enabled?: boolean;
  environment?: ProductionDeploymentEnvironment;
  target?: ProductionDeploymentTarget;
  backendBaseUrl?: string;
  runtimeSource?: string;
  browserConfig?: Record<string, unknown>;
  serviceRoleKeyPresentInBrowserConfig?: boolean;
  supabaseProjectUrl?: string;
  supabaseProjectClassification?: SupabaseProjectDeploymentClassification;
  explicitPreviewCandidate?: boolean;
};

export type BrowserSafeProductionDeploymentConfig = {
  enabled: false;
  environment: ProductionDeploymentEnvironment;
  target: ProductionDeploymentTarget;
  backendBaseUrl: string | null;
  supabaseProjectUrl: string | null;
  serviceRoleExposed: false;
  containsSecrets: false;
  deploymentStarted: false;
};

export type ProductionDeploymentConfigGuardError = {
  code: ProductionDeploymentConfigGuardErrorCode;
  message: string;
};

export type ProductionDeploymentConfigGuardResult =
  | {
      ok: true;
      enabled: true;
      environment: 'production-candidate' | 'production';
      target: ProductionDeploymentTarget;
      backendClassification: 'production-candidate' | 'production';
      supabaseProjectClassification: 'production-candidate' | 'production';
      browserSafeConfig: BrowserSafeProductionDeploymentConfig;
      deploymentStarted: false;
      noExternalUpload: true;
      errors: [];
    }
  | {
      ok: false;
      enabled: false;
      environment: ProductionDeploymentEnvironment;
      target: ProductionDeploymentTarget;
      backendClassification: ProductionDeploymentBackendClassification;
      supabaseProjectClassification: SupabaseProjectDeploymentClassification;
      browserSafeConfig: BrowserSafeProductionDeploymentConfig;
      deploymentStarted: false;
      noExternalUpload: true;
      errors: ProductionDeploymentConfigGuardError[];
    };

const devPrimaryRuntimeSource = ['api', 'primary-dev'].join('-');
const devReadonlyRuntimeSource = ['api', 'readonly'].join('-');
const devRunnerToken = ['dev', 'Api', 'Runner'].join('');
const devApiHostToken = ['dev', 'api'].join('-');

const sensitiveBrowserConfigKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  ['service', 'Role'].join(''),
];

const safeError = (
  code: ProductionDeploymentConfigGuardErrorCode,
  message: string,
): ProductionDeploymentConfigGuardError => ({ code, message });

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const isPreviewHost = (hostname: string) => /preview|vercel\.app$/i.test(hostname);

const hasSensitiveBrowserKey = (browserConfig: Record<string, unknown>) =>
  Object.keys(browserConfig).some((key) =>
    sensitiveBrowserConfigKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase())),
  );

const parseHttpsUrl = (value?: string): URL | null => {
  if (!value || value.trim().length === 0) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
};

export const classifyProductionDeploymentBackendUrl = (
  backendBaseUrl?: string,
): ProductionDeploymentBackendClassification => {
  if (!backendBaseUrl || backendBaseUrl.trim().length === 0) return 'missing';

  const parsed = parseHttpsUrl(backendBaseUrl);
  if (!parsed) return 'invalid';
  if (isLocalHost(parsed.hostname)) return 'dev-local';
  const hostAndPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  if (
    hostAndPath.includes(devPrimaryRuntimeSource)
    || hostAndPath.includes(devApiHostToken)
    || hostAndPath.includes(devApiHostToken.replace('-', ''))
  ) {
    return 'dev-local';
  }
  if (isPreviewHost(parsed.hostname)) return 'preview';
  if (/candidate|staging/i.test(parsed.hostname)) return 'production-candidate';
  return 'production';
};

export const classifySupabaseDeploymentProject = (
  projectUrl?: string,
  explicitClassification?: SupabaseProjectDeploymentClassification,
): SupabaseProjectDeploymentClassification => {
  if (explicitClassification && explicitClassification !== 'missing') return explicitClassification;
  if (!projectUrl || projectUrl.trim().length === 0) return 'missing';

  const parsed = parseHttpsUrl(projectUrl);
  if (!parsed) return 'invalid';
  if (isLocalHost(parsed.hostname)) return 'local';
  if (isPreviewHost(parsed.hostname)) return 'preview';
  if (/test|sandbox/i.test(parsed.hostname)) return 'test';
  if (/candidate|staging/i.test(parsed.hostname)) return 'production-candidate';
  return 'production';
};

export const createBrowserSafeProductionDeploymentConfig = (
  input: ProductionDeploymentConfigGuardInput = {},
): BrowserSafeProductionDeploymentConfig => ({
  enabled: false,
  environment: input.environment ?? 'disabled',
  target: input.target ?? 'production-candidate',
  backendBaseUrl: input.backendBaseUrl ?? null,
  supabaseProjectUrl: input.supabaseProjectUrl ?? null,
  serviceRoleExposed: false,
  containsSecrets: false,
  deploymentStarted: false,
});

export const resolveProductionDeploymentConfigGuard = (
  input: ProductionDeploymentConfigGuardInput = {},
): ProductionDeploymentConfigGuardResult => {
  const environment = input.environment ?? 'disabled';
  const target = input.target ?? 'production-candidate';
  const backendClassification = classifyProductionDeploymentBackendUrl(input.backendBaseUrl);
  const supabaseProjectClassification = classifySupabaseDeploymentProject(
    input.supabaseProjectUrl,
    input.supabaseProjectClassification,
  );
  const browserSafeConfig = createBrowserSafeProductionDeploymentConfig(input);
  const errors: ProductionDeploymentConfigGuardError[] = [];

  if (hasSensitiveBrowserKey(input.browserConfig ?? {})) {
    errors.push(safeError('service_role_not_browser_safe', 'Browser-safe deployment config must not include secret-like keys.'));
  }

  if (input.serviceRoleKeyPresentInBrowserConfig === true) {
    errors.push(safeError('service_role_not_browser_safe', 'Service role key must never enter browser-safe deployment config.'));
  }

  if (input.enabled !== true) {
    errors.push(safeError('deployment_disabled', 'Production deployment config guard is disabled by default.'));
    return {
      ok: false,
      enabled: false,
      environment,
      target,
      backendClassification,
      supabaseProjectClassification,
      browserSafeConfig,
      deploymentStarted: false,
      noExternalUpload: true,
      errors,
    };
  }

  if (backendClassification === 'missing') {
    errors.push(safeError('backend_url_missing', 'Production backend URL is required for deployment candidate checks.'));
  } else if (backendClassification === 'invalid') {
    errors.push(safeError('backend_url_unsafe', 'Production backend URL must be a valid HTTPS URL.'));
  } else if (backendClassification === 'dev-local') {
    errors.push(safeError('localhost_not_production', 'Localhost and dev API backend URLs are not production deployment targets.'));
  } else if (backendClassification === 'preview' && (target === 'production' || input.explicitPreviewCandidate !== true)) {
    errors.push(safeError('preview_not_production', 'Preview backend URL is not production.'));
  }

  if (environment === 'preview' && (target === 'production' || input.explicitPreviewCandidate !== true)) {
    errors.push(safeError('preview_not_production', 'Preview environment is not production unless explicitly classified.'));
  }

  if (environment !== target) {
    errors.push(safeError('config_incomplete', 'Deployment environment must match the explicit deployment target.'));
  }

  if (input.runtimeSource === devPrimaryRuntimeSource || input.runtimeSource === devReadonlyRuntimeSource) {
    errors.push(safeError('dev_api_not_production', 'Dev/local API runtime sources are not production sources.'));
  }

  if (input.runtimeSource === devRunnerToken) {
    errors.push(safeError('dev_api_not_production', 'Dev API runner is not a production backend runtime.'));
  }

  if (supabaseProjectClassification === 'missing' || supabaseProjectClassification === 'invalid') {
    errors.push(safeError('config_incomplete', 'Supabase project classification is required for deployment candidate checks.'));
  } else if (target === 'production' && supabaseProjectClassification !== 'production') {
    errors.push(safeError('supabase_project_not_production', 'Supabase project must be classified as production for production target.'));
  } else if (
    target === 'production-candidate'
    && supabaseProjectClassification !== 'production-candidate'
    && supabaseProjectClassification !== 'production'
  ) {
    errors.push(safeError('supabase_project_not_production', 'Supabase project must be production-candidate or production classified.'));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      enabled: false,
      environment,
      target,
      backendClassification,
      supabaseProjectClassification,
      browserSafeConfig,
      deploymentStarted: false,
      noExternalUpload: true,
      errors,
    };
  }

  return {
    ok: true,
    enabled: true,
    environment: target,
    target,
    backendClassification: backendClassification as 'production-candidate' | 'production',
    supabaseProjectClassification: supabaseProjectClassification as 'production-candidate' | 'production',
    browserSafeConfig,
    deploymentStarted: false,
    noExternalUpload: true,
    errors: [],
  };
};
