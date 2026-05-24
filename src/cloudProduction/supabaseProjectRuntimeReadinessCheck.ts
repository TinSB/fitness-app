import {
  resolveAuthEnvironmentCallbackGuard,
  type AuthEnvironmentCallbackGuardResult,
} from './authEnvironmentCallbackGuard';
import {
  resolveSupabaseEnvironmentProjectGuard,
  type SupabaseProjectGuardResult,
} from './supabaseEnvironmentProjectGuard';

export const PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID =
  'phase20b-supabase-project-runtime-readiness-check';

export const PHASE20B_REQUIRED_BROWSER_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_IRONPATH_AUTH_CALLBACK_URL',
  'VITE_IRONPATH_CLOUD_ENVIRONMENT',
] as const;

export type Phase20bRequiredBrowserEnvKey =
  typeof PHASE20B_REQUIRED_BROWSER_ENV_KEYS[number];

export type Phase20bSupabaseProjectRuntimeReadinessStatus =
  | 'disabled'
  | 'phase20a_authorization_missing'
  | 'environment_missing'
  | 'project_rejected'
  | 'auth_callback_rejected'
  | 'service_role_risk'
  | 'runtime_boundary_unsafe'
  | 'ready_for_auth_runtime_wiring';

export type Phase20bSupabaseProjectRuntimeReadinessBlocker =
  | 'readiness_disabled'
  | 'phase20a_not_authorized'
  | 'project_url_missing'
  | 'anon_key_missing'
  | 'cloud_environment_missing'
  | 'cloud_environment_not_production'
  | 'project_url_invalid'
  | 'localhost_project_rejected'
  | 'preview_project_rejected'
  | 'auth_provider_missing'
  | 'auth_callback_url_missing'
  | 'auth_callback_url_unsafe'
  | 'localhost_callback_rejected'
  | 'preview_callback_rejected'
  | 'service_role_browser_risk'
  | 'secret_like_browser_config'
  | 'project_guard_rejected'
  | 'auth_callback_guard_rejected'
  | 'auth_runtime_already_enabled'
  | 'sync_runtime_already_enabled'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted'
  | 'live_sync_already_active';

export type Phase20bSupabaseProjectRuntimeReadinessWarning =
  | 'readiness_check_only'
  | 'no_client_created'
  | 'no_network_request'
  | 'localStorage_remains_fallback'
  | 'manual_opt_in_still_required';

export type Phase20bAuthorizationLike = {
  runtimeImplementationAuthorized: boolean;
  canStart20B: boolean;
  liveCloudSyncActivated: boolean;
  authRuntimeEnabled: boolean;
  syncRuntimeEnabled: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20bRuntimeBoundaryEvidence = {
  authRuntimeEnabled: boolean;
  syncRuntimeEnabled: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20bEnvRecord = Partial<Record<string, string | undefined>>;

export type Phase20bSupabaseProjectRuntimeReadinessInput = {
  enabled?: boolean;
  phase20aAuthorization?: Phase20bAuthorizationLike | null;
  browserEnv?: Phase20bEnvRecord | null;
  runtimeBoundary?: Partial<Phase20bRuntimeBoundaryEvidence> | null;
  serviceRoleKeyPresent?: boolean;
  browserConfig?: Record<string, unknown>;
  nowIso?: string;
  readinessId?: string;
};

export type Phase20bSupabaseProjectRuntimeReadinessResult = {
  id: string;
  baseId: typeof PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID;
  phase: '20B';
  ok: boolean;
  status: Phase20bSupabaseProjectRuntimeReadinessStatus;
  readyFor20C: boolean;
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[];
  warnings: Phase20bSupabaseProjectRuntimeReadinessWarning[];
  missingBrowserEnvKeys: Phase20bRequiredBrowserEnvKey[];
  projectGuard: SupabaseProjectGuardResult;
  authCallbackGuard: AuthEnvironmentCallbackGuardResult;
  browserSafeConfigReady: boolean;
  clientCreated: false;
  networkAttempted: false;
  authRuntimeEnabled: false;
  syncRuntimeEnabled: false;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: true;
  serviceRoleExposed: false;
  secretsExposed: false;
  nextPhase: '20C - Auth Runtime Wiring V1';
  createdAt: string;
};

const hashText = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const addUnique = <TValue extends string>(values: TValue[], value: TValue) => {
  if (!values.includes(value)) values.push(value);
};

const readEnvValue = (
  env: Phase20bEnvRecord | null | undefined,
  key: Phase20bRequiredBrowserEnvKey,
) => {
  const value = env?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const collectMissingBrowserEnvKeys = (
  env: Phase20bEnvRecord | null | undefined,
): Phase20bRequiredBrowserEnvKey[] =>
  PHASE20B_REQUIRED_BROWSER_ENV_KEYS.filter((key) => !readEnvValue(env, key));

const runtimeEnvironment = (env: Phase20bEnvRecord | null | undefined) => {
  const value = readEnvValue(env, 'VITE_IRONPATH_CLOUD_ENVIRONMENT');
  return value === 'production' || value === 'preview' || value === 'development'
    ? value
    : 'disabled';
};

const addAuthorizationBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
  authorization: Phase20bAuthorizationLike | null | undefined,
) => {
  if (
    authorization?.runtimeImplementationAuthorized !== true ||
    authorization.canStart20B !== true
  ) {
    addUnique(blockers, 'phase20a_not_authorized');
  }
  if (authorization?.authRuntimeEnabled === true) addUnique(blockers, 'auth_runtime_already_enabled');
  if (authorization?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (authorization?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (authorization?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (authorization?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (authorization?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (authorization?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (authorization?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
  boundary: Partial<Phase20bRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.authRuntimeEnabled === true) addUnique(blockers, 'auth_runtime_already_enabled');
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addMissingEnvBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
  missingKeys: Phase20bRequiredBrowserEnvKey[],
) => {
  if (missingKeys.includes('VITE_SUPABASE_URL')) addUnique(blockers, 'project_url_missing');
  if (missingKeys.includes('VITE_SUPABASE_ANON_KEY')) addUnique(blockers, 'anon_key_missing');
  if (missingKeys.includes('VITE_IRONPATH_AUTH_CALLBACK_URL')) {
    addUnique(blockers, 'auth_callback_url_missing');
  }
  if (missingKeys.includes('VITE_IRONPATH_CLOUD_ENVIRONMENT')) {
    addUnique(blockers, 'cloud_environment_missing');
  }
};

const addProjectGuardBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
  guard: SupabaseProjectGuardResult,
) => {
  for (const error of guard.errors) {
    if (error.code === 'project_url_missing') addUnique(blockers, 'project_url_missing');
    if (error.code === 'project_url_invalid') addUnique(blockers, 'project_url_invalid');
    if (error.code === 'localhost_not_production') addUnique(blockers, 'localhost_project_rejected');
    if (error.code === 'preview_not_production') addUnique(blockers, 'preview_project_rejected');
    if (error.code === 'anon_key_missing') addUnique(blockers, 'anon_key_missing');
    if (error.code === 'service_role_not_browser_safe') addUnique(blockers, 'service_role_browser_risk');
    if (error.code === 'secret_exposed_to_browser') addUnique(blockers, 'secret_like_browser_config');
    if (error.code === 'config_incomplete') addUnique(blockers, 'cloud_environment_not_production');
  }
  if (!guard.ok) addUnique(blockers, 'project_guard_rejected');
};

const addAuthCallbackGuardBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
  guard: AuthEnvironmentCallbackGuardResult,
) => {
  for (const error of guard.errors) {
    if (error.code === 'provider_config_missing') addUnique(blockers, 'auth_provider_missing');
    if (error.code === 'callback_url_missing') addUnique(blockers, 'auth_callback_url_missing');
    if (error.code === 'callback_url_unsafe') addUnique(blockers, 'auth_callback_url_unsafe');
    if (error.code === 'localhost_not_allowed_for_production') {
      addUnique(blockers, 'localhost_callback_rejected');
    }
    if (error.code === 'preview_not_production') addUnique(blockers, 'preview_callback_rejected');
    if (error.code === 'secret_exposed_to_browser') addUnique(blockers, 'secret_like_browser_config');
    if (error.code === 'provider_not_enabled') addUnique(blockers, 'cloud_environment_not_production');
  }
  if (!guard.ok) addUnique(blockers, 'auth_callback_guard_rejected');
};

const statusFromBlockers = (
  blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[],
): Phase20bSupabaseProjectRuntimeReadinessStatus => {
  if (blockers.includes('readiness_disabled')) return 'disabled';
  if (blockers.includes('phase20a_not_authorized')) return 'phase20a_authorization_missing';
  if (
    blockers.includes('project_url_missing') ||
    blockers.includes('anon_key_missing') ||
    blockers.includes('auth_callback_url_missing') ||
    blockers.includes('cloud_environment_missing')
  ) return 'environment_missing';
  if (
    blockers.includes('service_role_browser_risk') ||
    blockers.includes('secret_like_browser_config')
  ) return 'service_role_risk';
  if (
    blockers.includes('auth_runtime_already_enabled') ||
    blockers.includes('sync_runtime_already_enabled') ||
    blockers.includes('live_sync_already_active') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled') ||
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('localStorage_deleted')
  ) return 'runtime_boundary_unsafe';
  if (blockers.includes('project_guard_rejected')) return 'project_rejected';
  if (blockers.includes('auth_callback_guard_rejected')) return 'auth_callback_rejected';
  return 'ready_for_auth_runtime_wiring';
};

export const buildSupabaseProjectRuntimeReadinessCheck = (
  input: Phase20bSupabaseProjectRuntimeReadinessInput = {},
): Phase20bSupabaseProjectRuntimeReadinessResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const env = input.browserEnv ?? {};
  const environment = runtimeEnvironment(env);
  const missingBrowserEnvKeys = collectMissingBrowserEnvKeys(env);
  const projectUrl = readEnvValue(env, 'VITE_SUPABASE_URL');
  const anonKey = readEnvValue(env, 'VITE_SUPABASE_ANON_KEY');
  const callbackUrl = readEnvValue(env, 'VITE_IRONPATH_AUTH_CALLBACK_URL');
  const enabled = input.enabled === true;
  const projectGuard = resolveSupabaseEnvironmentProjectGuard({
    enabled,
    environment,
    projectUrl,
    anonKey,
    serviceRoleKeyPresent: input.serviceRoleKeyPresent,
    browserConfig: input.browserConfig,
  });
  const authCallbackGuard = resolveAuthEnvironmentCallbackGuard({
    enabled,
    providerCandidate: 'supabase-auth-candidate',
    environment,
    callbackUrl,
    browserConfig: input.browserConfig,
  });
  const blockers: Phase20bSupabaseProjectRuntimeReadinessBlocker[] = [];
  const warnings: Phase20bSupabaseProjectRuntimeReadinessWarning[] = [
    'readiness_check_only',
    'no_client_created',
    'no_network_request',
    'localStorage_remains_fallback',
    'manual_opt_in_still_required',
  ];

  if (!enabled) addUnique(blockers, 'readiness_disabled');
  addAuthorizationBlockers(blockers, input.phase20aAuthorization);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);
  addMissingEnvBlockers(blockers, missingBrowserEnvKeys);
  addProjectGuardBlockers(blockers, projectGuard);
  addAuthCallbackGuardBlockers(blockers, authCallbackGuard);

  const status = statusFromBlockers(blockers);
  const ok = status === 'ready_for_auth_runtime_wiring';

  return {
    id: input.readinessId ??
      `${PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID}-${hashText(createdAt)}`,
    baseId: PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID,
    phase: '20B',
    ok,
    status,
    readyFor20C: ok,
    blockers,
    warnings,
    missingBrowserEnvKeys,
    projectGuard,
    authCallbackGuard,
    browserSafeConfigReady: ok,
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
    createdAt,
  };
};
