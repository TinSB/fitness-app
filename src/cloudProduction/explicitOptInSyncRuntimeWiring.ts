export const PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID =
  'phase20d-explicit-opt-in-sync-runtime-wiring';

export type Phase20dExplicitOptInSyncRuntimeStatus =
  | 'disabled'
  | 'auth_not_ready'
  | 'opt_in_missing'
  | 'manual_confirmation_missing'
  | 'local_fallback_unconfirmed'
  | 'no_silent_overwrite_unconfirmed'
  | 'backup_before_sync_unconfirmed'
  | 'runtime_boundary_unsafe'
  | 'sync_runtime_wired';

export type Phase20dExplicitOptInSyncRuntimeBlocker =
  | 'sync_wiring_disabled'
  | 'auth_runtime_not_ready'
  | 'authenticated_user_missing'
  | 'auth_token_storage_detected'
  | 'auth_localStorage_changed'
  | 'auth_secret_exposed'
  | 'auth_service_role_exposed'
  | 'explicit_opt_in_missing'
  | 'manual_confirmation_missing'
  | 'localStorage_fallback_not_confirmed'
  | 'no_silent_overwrite_not_confirmed'
  | 'backup_before_sync_not_confirmed'
  | 'sync_runtime_already_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase20dExplicitOptInSyncRuntimeWarning =
  | 'manual_sync_only'
  | 'backup_required_before_first_sync'
  | 'dry_run_required_before_first_write'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled'
  | 'no_background_sync'
  | 'no_upload_or_download';

export type Phase20dAuthRuntimeLike = {
  readyFor20D: boolean;
  authRuntimeEnabled: boolean;
  authenticated: boolean;
  user: {
    userId: string;
    accountId: string;
    displayName?: string;
  } | null;
  tokenStored: boolean;
  localStorageChanged: boolean;
  secretsExposed: boolean;
  serviceRoleExposed: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20dRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20dExplicitOptInSyncRuntimeInput = {
  enabled?: boolean;
  authRuntime?: Phase20dAuthRuntimeLike | null;
  explicitOptIn?: boolean;
  manualConfirmation?: boolean;
  localStorageFallbackConfirmed?: boolean;
  noSilentOverwriteConfirmed?: boolean;
  backupBeforeSyncConfirmed?: boolean;
  runtimeBoundary?: Partial<Phase20dRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  wiringId?: string;
};

export type Phase20dSyncRuntimeUser = {
  userId: string;
  accountId: string;
  displayName?: string;
};

export type Phase20dExplicitOptInSyncRuntimeResult = {
  id: string;
  baseId: typeof PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID;
  phase: '20D';
  ok: boolean;
  status: Phase20dExplicitOptInSyncRuntimeStatus;
  readyFor20E: boolean;
  user: Phase20dSyncRuntimeUser | null;
  blockers: Phase20dExplicitOptInSyncRuntimeBlocker[];
  warnings: Phase20dExplicitOptInSyncRuntimeWarning[];
  userMessage: '开启前先备份';
  explicitOptInAccepted: boolean;
  manualConfirmationAccepted: boolean;
  localStorageFallbackConfirmed: boolean;
  noSilentOverwriteConfirmed: boolean;
  backupBeforeSyncConfirmed: boolean;
  authRuntimeEnabled: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: true;
  requiresBackupBeforeFirstSync: true;
  requiresDryRunBeforeFirstWrite: true;
  requiresConflictReviewBeforeApply: true;
  nextPhase: '20E - Local Backup + Dry-Run Migration Runtime Flow V1';
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

const addAuthBlockers = (
  blockers: Phase20dExplicitOptInSyncRuntimeBlocker[],
  auth: Phase20dAuthRuntimeLike | null | undefined,
) => {
  if (auth?.readyFor20D !== true || auth.authRuntimeEnabled !== true) {
    addUnique(blockers, 'auth_runtime_not_ready');
  }
  if (auth?.authenticated !== true || !auth.user?.userId || !auth.user.accountId) {
    addUnique(blockers, 'authenticated_user_missing');
  }
  if (auth?.tokenStored === true) addUnique(blockers, 'auth_token_storage_detected');
  if (auth?.localStorageChanged === true) addUnique(blockers, 'auth_localStorage_changed');
  if (auth?.secretsExposed === true) addUnique(blockers, 'auth_secret_exposed');
  if (auth?.serviceRoleExposed === true) addUnique(blockers, 'auth_service_role_exposed');
  if (auth?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (auth?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (auth?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (auth?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (auth?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (auth?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (auth?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20dExplicitOptInSyncRuntimeBlocker[],
  boundary: Partial<Phase20dRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase20dExplicitOptInSyncRuntimeBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'sync_runtime_already_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted' ||
    blocker === 'auth_token_storage_detected' ||
    blocker === 'auth_localStorage_changed' ||
    blocker === 'auth_secret_exposed' ||
    blocker === 'auth_service_role_exposed'
  ));

const statusFromBlockers = (
  blockers: Phase20dExplicitOptInSyncRuntimeBlocker[],
): Phase20dExplicitOptInSyncRuntimeStatus => {
  if (blockers.includes('sync_wiring_disabled')) return 'disabled';
  if (blockers.includes('auth_runtime_not_ready') || blockers.includes('authenticated_user_missing')) {
    return 'auth_not_ready';
  }
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('explicit_opt_in_missing')) return 'opt_in_missing';
  if (blockers.includes('manual_confirmation_missing')) return 'manual_confirmation_missing';
  if (blockers.includes('localStorage_fallback_not_confirmed')) return 'local_fallback_unconfirmed';
  if (blockers.includes('no_silent_overwrite_not_confirmed')) return 'no_silent_overwrite_unconfirmed';
  if (blockers.includes('backup_before_sync_not_confirmed')) return 'backup_before_sync_unconfirmed';
  return 'sync_runtime_wired';
};

export const buildExplicitOptInSyncRuntimeWiring = (
  input: Phase20dExplicitOptInSyncRuntimeInput = {},
): Phase20dExplicitOptInSyncRuntimeResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20dExplicitOptInSyncRuntimeBlocker[] = [];
  const warnings: Phase20dExplicitOptInSyncRuntimeWarning[] = [
    'manual_sync_only',
    'backup_required_before_first_sync',
    'dry_run_required_before_first_write',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
    'no_background_sync',
    'no_upload_or_download',
  ];

  if (input.enabled !== true) addUnique(blockers, 'sync_wiring_disabled');
  addAuthBlockers(blockers, input.authRuntime);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);
  if (input.explicitOptIn !== true) addUnique(blockers, 'explicit_opt_in_missing');
  if (input.manualConfirmation !== true) addUnique(blockers, 'manual_confirmation_missing');
  if (input.localStorageFallbackConfirmed !== true) {
    addUnique(blockers, 'localStorage_fallback_not_confirmed');
  }
  if (input.noSilentOverwriteConfirmed !== true) {
    addUnique(blockers, 'no_silent_overwrite_not_confirmed');
  }
  if (input.backupBeforeSyncConfirmed !== true) {
    addUnique(blockers, 'backup_before_sync_not_confirmed');
  }

  const status = statusFromBlockers(blockers);
  const ok = status === 'sync_runtime_wired';
  const user = ok ? input.authRuntime?.user ?? null : null;

  return {
    id: input.wiringId ?? `${PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID}-${hashText(createdAt)}`,
    baseId: PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID,
    phase: '20D',
    ok,
    status,
    readyFor20E: ok,
    user,
    blockers,
    warnings,
    userMessage: '开启前先备份',
    explicitOptInAccepted: ok,
    manualConfirmationAccepted: ok,
    localStorageFallbackConfirmed: input.localStorageFallbackConfirmed === true,
    noSilentOverwriteConfirmed: input.noSilentOverwriteConfirmed === true,
    backupBeforeSyncConfirmed: input.backupBeforeSyncConfirmed === true,
    authRuntimeEnabled: input.authRuntime?.authRuntimeEnabled === true && !hasRuntimeBoundaryBlocker(blockers),
    syncRuntimeEnabled: ok,
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: true,
    requiresBackupBeforeFirstSync: true,
    requiresDryRunBeforeFirstWrite: true,
    requiresConflictReviewBeforeApply: true,
    nextPhase: '20E - Local Backup + Dry-Run Migration Runtime Flow V1',
    createdAt,
  };
};
