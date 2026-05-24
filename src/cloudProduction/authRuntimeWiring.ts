export const PHASE20C_AUTH_RUNTIME_WIRING_ID = 'phase20c-auth-runtime-wiring';

export type Phase20cAuthAction = 'check_session' | 'sign_in' | 'sign_out';

export type Phase20cAuthRuntimeStatus =
  | 'disabled'
  | 'readiness_missing'
  | 'adapter_missing'
  | 'user_action_required'
  | 'session_checked'
  | 'signed_in'
  | 'signed_out'
  | 'adapter_failed'
  | 'runtime_boundary_unsafe';

export type Phase20cAuthRuntimeBlocker =
  | 'auth_wiring_disabled'
  | 'phase20b_not_ready'
  | 'phase20b_missing_env'
  | 'phase20b_client_created'
  | 'phase20b_network_attempted'
  | 'phase20b_service_role_exposed'
  | 'phase20b_secret_exposed'
  | 'phase20b_source_of_truth_changed'
  | 'phase20b_localStorage_deleted'
  | 'auth_adapter_missing'
  | 'user_action_missing'
  | 'adapter_failed'
  | 'adapter_token_storage_detected'
  | 'adapter_secret_exposed'
  | 'adapter_localStorage_changed'
  | 'sync_runtime_already_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase20cAuthRuntimeWarning =
  | 'auth_runtime_wiring_only'
  | 'manual_user_action_required'
  | 'tokens_not_stored'
  | 'sync_still_off'
  | 'localStorage_remains_fallback';

export type Phase20cAuthProviderName =
  | 'supabase-auth-runtime'
  | 'synthetic-auth-runtime';

export type Phase20cAuthUser = {
  userId: string;
  accountId: string;
  displayName?: string;
};

export type Phase20cAuthAdapterResult = {
  ok: boolean;
  status: 'authenticated' | 'unauthenticated' | 'signed_out' | 'failed' | 'unsupported';
  user: Phase20cAuthUser | null;
  message: string;
  networkAttempted: boolean;
  tokenStored: boolean;
  localStorageChanged: boolean;
  secretsExposed: boolean;
};

export type Phase20cAuthRuntimeAdapter = {
  providerName: Phase20cAuthProviderName;
  checkSession: () => Phase20cAuthAdapterResult;
  signIn: () => Phase20cAuthAdapterResult;
  signOut: () => Phase20cAuthAdapterResult;
};

export type Phase20cReadinessLike = {
  readyFor20C: boolean;
  missingBrowserEnvKeys?: string[];
  clientCreated: boolean;
  networkAttempted: boolean;
  serviceRoleExposed: boolean;
  secretsExposed: boolean;
  authRuntimeEnabled: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20cRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20cAuthRuntimeWiringInput = {
  enabled?: boolean;
  readiness?: Phase20cReadinessLike | null;
  adapter?: Phase20cAuthRuntimeAdapter | null;
  action?: Phase20cAuthAction;
  userInitiated?: boolean;
  runtimeBoundary?: Partial<Phase20cRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  wiringId?: string;
};

export type Phase20cAuthRuntimeWiringResult = {
  id: string;
  baseId: typeof PHASE20C_AUTH_RUNTIME_WIRING_ID;
  phase: '20C';
  ok: boolean;
  status: Phase20cAuthRuntimeStatus;
  action: Phase20cAuthAction;
  providerName: Phase20cAuthProviderName | null;
  user: Phase20cAuthUser | null;
  readyFor20D: boolean;
  blockers: Phase20cAuthRuntimeBlocker[];
  warnings: Phase20cAuthRuntimeWarning[];
  authRuntimeEnabled: boolean;
  authenticated: boolean;
  sessionChecked: boolean;
  userActionRequired: boolean;
  clientCreated: false;
  tokenStored: false;
  localStorageChanged: false;
  localStorageDeleted: false;
  networkAttempted: boolean;
  secretsExposed: false;
  serviceRoleExposed: false;
  syncRuntimeEnabled: false;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  sourceOfTruthChanged: false;
  localStorageFallbackPreserved: true;
  nextPhase: '20D - Explicit Opt-In Sync Runtime Wiring V1';
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

const emptyAdapterResult = (message: string): Phase20cAuthAdapterResult => ({
  ok: false,
  status: 'unsupported',
  user: null,
  message,
  networkAttempted: false,
  tokenStored: false,
  localStorageChanged: false,
  secretsExposed: false,
});

export const createSyntheticAuthRuntimeAdapter = (
  user: Phase20cAuthUser | null = null,
): Phase20cAuthRuntimeAdapter => ({
  providerName: 'synthetic-auth-runtime',
  checkSession: () => ({
    ok: true,
    status: user ? 'authenticated' : 'unauthenticated',
    user,
    message: user ? 'Synthetic session is available.' : 'Synthetic session is empty.',
    networkAttempted: false,
    tokenStored: false,
    localStorageChanged: false,
    secretsExposed: false,
  }),
  signIn: () => ({
    ok: Boolean(user),
    status: user ? 'authenticated' : 'failed',
    user,
    message: user ? 'Synthetic sign-in succeeded.' : 'Synthetic sign-in user is missing.',
    networkAttempted: false,
    tokenStored: false,
    localStorageChanged: false,
    secretsExposed: false,
  }),
  signOut: () => ({
    ok: true,
    status: 'signed_out',
    user: null,
    message: 'Synthetic sign-out completed.',
    networkAttempted: false,
    tokenStored: false,
    localStorageChanged: false,
    secretsExposed: false,
  }),
});

const addReadinessBlockers = (
  blockers: Phase20cAuthRuntimeBlocker[],
  readiness: Phase20cReadinessLike | null | undefined,
) => {
  if (readiness?.readyFor20C !== true) addUnique(blockers, 'phase20b_not_ready');
  if ((readiness?.missingBrowserEnvKeys?.length ?? 0) > 0) addUnique(blockers, 'phase20b_missing_env');
  if (readiness?.clientCreated === true) addUnique(blockers, 'phase20b_client_created');
  if (readiness?.networkAttempted === true) addUnique(blockers, 'phase20b_network_attempted');
  if (readiness?.serviceRoleExposed === true) addUnique(blockers, 'phase20b_service_role_exposed');
  if (readiness?.secretsExposed === true) addUnique(blockers, 'phase20b_secret_exposed');
  if (readiness?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (readiness?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (readiness?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (readiness?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (readiness?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (readiness?.sourceOfTruthChanged === true) addUnique(blockers, 'phase20b_source_of_truth_changed');
  if (readiness?.localStorageDeleted === true) addUnique(blockers, 'phase20b_localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20cAuthRuntimeBlocker[],
  boundary: Partial<Phase20cRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addAdapterResultBlockers = (
  blockers: Phase20cAuthRuntimeBlocker[],
  result: Phase20cAuthAdapterResult,
) => {
  if (!result.ok && result.status !== 'unauthenticated' && result.status !== 'signed_out') {
    addUnique(blockers, 'adapter_failed');
  }
  if (result.tokenStored === true) addUnique(blockers, 'adapter_token_storage_detected');
  if (result.localStorageChanged === true) addUnique(blockers, 'adapter_localStorage_changed');
  if (result.secretsExposed === true) addUnique(blockers, 'adapter_secret_exposed');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase20cAuthRuntimeBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'sync_runtime_already_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted' ||
    blocker === 'phase20b_client_created' ||
    blocker === 'phase20b_network_attempted' ||
    blocker === 'phase20b_service_role_exposed' ||
    blocker === 'phase20b_secret_exposed' ||
    blocker === 'phase20b_source_of_truth_changed' ||
    blocker === 'phase20b_localStorage_deleted' ||
    blocker === 'adapter_token_storage_detected' ||
    blocker === 'adapter_localStorage_changed' ||
    blocker === 'adapter_secret_exposed'
  ));

const statusFromBlockers = (
  blockers: Phase20cAuthRuntimeBlocker[],
  action: Phase20cAuthAction,
  adapterResult: Phase20cAuthAdapterResult | null,
): Phase20cAuthRuntimeStatus => {
  if (blockers.includes('auth_wiring_disabled')) return 'disabled';
  if (blockers.includes('phase20b_not_ready') || blockers.includes('phase20b_missing_env')) {
    return 'readiness_missing';
  }
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('auth_adapter_missing')) return 'adapter_missing';
  if (blockers.includes('user_action_missing')) return 'user_action_required';
  if (blockers.includes('adapter_failed')) return 'adapter_failed';
  if (action === 'sign_in' && adapterResult?.status === 'authenticated') return 'signed_in';
  if (action === 'sign_out' && adapterResult?.status === 'signed_out') return 'signed_out';
  return 'session_checked';
};

const runAdapterAction = (
  adapter: Phase20cAuthRuntimeAdapter | null | undefined,
  action: Phase20cAuthAction,
) => {
  if (!adapter) return emptyAdapterResult('Auth runtime adapter is missing.');
  if (action === 'sign_in') return adapter.signIn();
  if (action === 'sign_out') return adapter.signOut();
  return adapter.checkSession();
};

export const buildAuthRuntimeWiring = (
  input: Phase20cAuthRuntimeWiringInput = {},
): Phase20cAuthRuntimeWiringResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const action = input.action ?? 'check_session';
  const blockers: Phase20cAuthRuntimeBlocker[] = [];
  const warnings: Phase20cAuthRuntimeWarning[] = [
    'auth_runtime_wiring_only',
    'manual_user_action_required',
    'tokens_not_stored',
    'sync_still_off',
    'localStorage_remains_fallback',
  ];

  if (input.enabled !== true) addUnique(blockers, 'auth_wiring_disabled');
  addReadinessBlockers(blockers, input.readiness);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);
  if (!input.adapter) addUnique(blockers, 'auth_adapter_missing');
  if ((action === 'sign_in' || action === 'sign_out') && input.userInitiated !== true) {
    addUnique(blockers, 'user_action_missing');
  }

  const canRunAdapter =
    input.enabled === true &&
    input.readiness?.readyFor20C === true &&
    !hasRuntimeBoundaryBlocker(blockers) &&
    Boolean(input.adapter) &&
    !blockers.includes('user_action_missing');
  const adapterResult = canRunAdapter ? runAdapterAction(input.adapter, action) : null;
  if (adapterResult) addAdapterResultBlockers(blockers, adapterResult);

  const status = statusFromBlockers(blockers, action, adapterResult);
  const ok =
    status === 'session_checked' ||
    status === 'signed_in' ||
    status === 'signed_out';
  const authenticated = ok && adapterResult?.status === 'authenticated' && Boolean(adapterResult.user);

  return {
    id: input.wiringId ?? `${PHASE20C_AUTH_RUNTIME_WIRING_ID}-${hashText(createdAt)}`,
    baseId: PHASE20C_AUTH_RUNTIME_WIRING_ID,
    phase: '20C',
    ok,
    status,
    action,
    providerName: input.adapter?.providerName ?? null,
    user: authenticated ? adapterResult?.user ?? null : null,
    readyFor20D: ok && authenticated,
    blockers,
    warnings,
    authRuntimeEnabled: ok,
    authenticated,
    sessionChecked: Boolean(adapterResult),
    userActionRequired: blockers.includes('user_action_missing'),
    clientCreated: false,
    tokenStored: false,
    localStorageChanged: false,
    localStorageDeleted: false,
    networkAttempted: adapterResult?.networkAttempted === true,
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
    createdAt,
  };
};
