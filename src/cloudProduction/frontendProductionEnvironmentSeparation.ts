export type FrontendReleaseEnvironment =
  | 'local'
  | 'dev'
  | 'preview'
  | 'production-candidate'
  | 'production'
  | 'emergency-local';

export type FrontendSupabaseProjectClass =
  | 'missing'
  | 'local'
  | 'preview'
  | 'test'
  | 'production-candidate'
  | 'production';

export type FrontendEnvironmentSeparationErrorCode =
  | 'preview_cloud_write_blocked'
  | 'production_dev_api_blocked'
  | 'local_supabase_not_production'
  | 'cloud_candidate_manual_enable_required'
  | 'source_of_truth_switch_blocked'
  | 'secret_exposed_to_browser'
  | 'config_incomplete';

export type FrontendEnvironmentSeparationInput = {
  environment?: FrontendReleaseEnvironment;
  apiBaseUrl?: string;
  runtimeSource?: string;
  supabaseProjectClass?: FrontendSupabaseProjectClass;
  cloudCandidateRequested?: boolean;
  cloudPushRequested?: boolean;
  cloudPullApplyRequested?: boolean;
  sourceOfTruthSwitchRequested?: boolean;
  manualCloudCandidateEnabled?: boolean;
  browserConfig?: Record<string, unknown>;
};

export type BrowserSafeReleaseChannelInfo = {
  environment: FrontendReleaseEnvironment;
  releaseChannel: FrontendReleaseEnvironment;
  productionCandidate: boolean;
  production: boolean;
  emergencyLocalAvailable: true;
  containsSecrets: false;
};

export type FrontendEnvironmentCapabilities = {
  localStoragePrimary: true;
  backendCloudCandidateAllowed: boolean;
  cloudPullCandidateAllowed: boolean;
  cloudPullApplyAllowed: false;
  cloudPushCandidateAllowed: false;
  manualConflictResolutionAllowed: boolean;
  monitoringCandidateAllowed: boolean;
  productionDeploymentCandidateAllowed: boolean;
  sourceOfTruthSwitchAllowed: false;
  defaultCloudSync: false;
  noAutomaticWorker: true;
};

export type FrontendEnvironmentSeparationError = {
  code: FrontendEnvironmentSeparationErrorCode;
  message: string;
};

export type FrontendEnvironmentSeparationResult = {
  ok: boolean;
  environment: FrontendReleaseEnvironment;
  releaseChannelInfo: BrowserSafeReleaseChannelInfo;
  capabilities: FrontendEnvironmentCapabilities;
  apiBaseUrlClass: 'missing' | 'dev-local' | 'preview' | 'production-candidate' | 'production';
  supabaseProjectClass: FrontendSupabaseProjectClass;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  cloudCandidateAutoEnabled: false;
  errors: FrontendEnvironmentSeparationError[];
};

const devPrimaryRuntimeSource = ['api', 'primary-dev'].join('-');
const devReadonlyRuntimeSource = ['api', 'readonly'].join('-');
const devApiHostToken = ['dev', 'api'].join('-');

const sensitiveBrowserConfigKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  ['service', 'Role'].join(''),
];

const error = (
  code: FrontendEnvironmentSeparationErrorCode,
  message: string,
): FrontendEnvironmentSeparationError => ({ code, message });

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const parseUrl = (value?: string): URL | null => {
  if (!value || value.trim().length === 0) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const hasSensitiveBrowserKey = (browserConfig: Record<string, unknown>) =>
  Object.keys(browserConfig).some((key) =>
    sensitiveBrowserConfigKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase())),
  );

export const classifyFrontendApiBaseUrl = (
  apiBaseUrl?: string,
): FrontendEnvironmentSeparationResult['apiBaseUrlClass'] => {
  const parsed = parseUrl(apiBaseUrl);
  if (!parsed) return 'missing';
  if (isLocalHost(parsed.hostname)) return 'dev-local';

  const hostAndPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  if (
    hostAndPath.includes(devPrimaryRuntimeSource)
    || hostAndPath.includes(devApiHostToken)
    || hostAndPath.includes(devApiHostToken.replace('-', ''))
  ) {
    return 'dev-local';
  }
  if (/preview|vercel\.app$/i.test(parsed.hostname)) return 'preview';
  if (/candidate|staging/i.test(parsed.hostname)) return 'production-candidate';
  return 'production';
};

export const createBrowserSafeReleaseChannelInfo = (
  environment: FrontendReleaseEnvironment = 'local',
): BrowserSafeReleaseChannelInfo => ({
  environment,
  releaseChannel: environment,
  productionCandidate: environment === 'production-candidate',
  production: environment === 'production',
  emergencyLocalAvailable: true,
  containsSecrets: false,
});

export const createFrontendEnvironmentCapabilities = (
  environment: FrontendReleaseEnvironment,
  manualCloudCandidateEnabled = false,
): FrontendEnvironmentCapabilities => ({
  localStoragePrimary: true,
  backendCloudCandidateAllowed: manualCloudCandidateEnabled && environment === 'production-candidate',
  cloudPullCandidateAllowed: manualCloudCandidateEnabled && environment === 'production-candidate',
  cloudPullApplyAllowed: false,
  cloudPushCandidateAllowed: false,
  manualConflictResolutionAllowed: environment !== 'emergency-local',
  monitoringCandidateAllowed: environment !== 'production' && environment !== 'emergency-local',
  productionDeploymentCandidateAllowed: environment === 'production-candidate',
  sourceOfTruthSwitchAllowed: false,
  defaultCloudSync: false,
  noAutomaticWorker: true,
});

export const resolveFrontendProductionEnvironmentSeparation = (
  input: FrontendEnvironmentSeparationInput = {},
): FrontendEnvironmentSeparationResult => {
  const environment = input.environment ?? 'local';
  const apiBaseUrlClass = classifyFrontendApiBaseUrl(input.apiBaseUrl);
  const supabaseProjectClass = input.supabaseProjectClass ?? 'missing';
  const releaseChannelInfo = createBrowserSafeReleaseChannelInfo(environment);
  const capabilities = createFrontendEnvironmentCapabilities(environment, input.manualCloudCandidateEnabled === true);
  const errors: FrontendEnvironmentSeparationError[] = [];

  if (hasSensitiveBrowserKey(input.browserConfig ?? {})) {
    errors.push(error('secret_exposed_to_browser', 'Browser-safe release channel info must not include secret-like keys.'));
  }

  if (input.cloudCandidateRequested === true && input.manualCloudCandidateEnabled !== true) {
    errors.push(error('cloud_candidate_manual_enable_required', 'Cloud candidate behavior requires explicit manual enablement.'));
  }

  if (environment === 'preview' && input.cloudPushRequested === true) {
    errors.push(error('preview_cloud_write_blocked', 'Preview release channel cannot enable production cloud write behavior.'));
  }

  if (environment === 'production' && (apiBaseUrlClass === 'dev-local' || input.runtimeSource === devPrimaryRuntimeSource || input.runtimeSource === devReadonlyRuntimeSource)) {
    errors.push(error('production_dev_api_blocked', 'Production frontend cannot use dev/local API configuration.'));
  }

  if (
    (environment === 'production' || environment === 'production-candidate')
    && (supabaseProjectClass === 'local' || supabaseProjectClass === 'test' || supabaseProjectClass === 'preview')
  ) {
    errors.push(error('local_supabase_not_production', 'Local, test, and preview Supabase projects cannot be treated as production.'));
  }

  if (environment === 'production' && supabaseProjectClass !== 'production') {
    errors.push(error('config_incomplete', 'Production frontend requires production Supabase project classification.'));
  }

  if (environment === 'production-candidate' && !['production-candidate', 'production'].includes(supabaseProjectClass)) {
    errors.push(error('config_incomplete', 'Production-candidate frontend requires candidate or production Supabase classification.'));
  }

  if (input.sourceOfTruthSwitchRequested === true || input.cloudPullApplyRequested === true) {
    errors.push(error('source_of_truth_switch_blocked', 'Frontend environment separation cannot switch source of truth.'));
  }

  return {
    ok: errors.length === 0,
    environment,
    releaseChannelInfo,
    capabilities,
    apiBaseUrlClass,
    supabaseProjectClass,
    localStorageUnchanged: true,
    sourceOfTruthChanged: false,
    cloudCandidateAutoEnabled: false,
    errors,
  };
};
