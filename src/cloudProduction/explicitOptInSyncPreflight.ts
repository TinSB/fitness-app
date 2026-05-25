import type { Phase20bSupabaseProjectRuntimeReadinessResult } from './supabaseProjectRuntimeReadinessCheck';

export const PHASE21A_EXPLICIT_OPT_IN_SYNC_PREFLIGHT_ID =
  'phase21a-explicit-opt-in-sync-preflight';

export type Phase21aExplicitOptInSyncPreflightStatus =
  | 'disabled'
  | 'readiness_missing'
  | 'sign_in_required'
  | 'runtime_boundary_unsafe'
  | 'ready_for_backup_dry_run';

export type Phase21aExplicitOptInSyncPreflightBlocker =
  | 'preflight_disabled'
  | 'phase20b_not_ready'
  | 'browser_config_not_ready'
  | 'service_role_exposed'
  | 'secret_exposed'
  | 'auth_runtime_not_ready'
  | 'authenticated_user_missing'
  | 'auth_token_storage_detected'
  | 'auth_localStorage_changed'
  | 'sync_runtime_already_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21aExplicitOptInSyncPreflightWarning =
  | 'manual_opt_in_required'
  | 'backup_required_before_first_upload'
  | 'dry_run_required_before_first_upload'
  | 'localStorage_remains_fallback'
  | 'no_silent_overwrite'
  | 'no_default_sync'
  | 'no_background_sync'
  | 'cloud_primary_not_enabled';

export type Phase21aRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21aExplicitOptInSyncPreflightUser = {
  userId: string;
  accountId: string;
  displayName?: string;
};

export type Phase21aAuthRuntimeEvidence = {
  readyFor20D: boolean;
  authRuntimeEnabled: boolean;
  authenticated: boolean;
  user: Phase21aExplicitOptInSyncPreflightUser | null;
  tokenStored: boolean;
  localStorageChanged: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21aExplicitOptInSyncPreflightInput = {
  enabled?: boolean;
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
  authRuntime?: Phase21aAuthRuntimeEvidence | null;
  runtimeBoundary?: Partial<Phase21aRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  preflightId?: string;
};

export type Phase21aExplicitOptInSyncPreflightResult = {
  id: string;
  baseId: typeof PHASE21A_EXPLICIT_OPT_IN_SYNC_PREFLIGHT_ID;
  phase: '21A';
  ok: boolean;
  status: Phase21aExplicitOptInSyncPreflightStatus;
  readyFor21B: boolean;
  syncPreflightVisible: boolean;
  user: Phase21aExplicitOptInSyncPreflightUser | null;
  blockers: Phase21aExplicitOptInSyncPreflightBlocker[];
  warnings: Phase21aExplicitOptInSyncPreflightWarning[];
  userMessage: '本地数据仍会保留';
  primaryActionLabel: '检查本地数据';
  secondaryActionLabels: ['开启前先备份', '查看将同步的内容'];
  requiresExplicitOptIn: true;
  requiresBackupBeforeFirstUpload: true;
  requiresDryRunBeforeFirstUpload: true;
  requiresManualConfirmationBeforeUpload: true;
  requiresConflictReviewBeforeApply: true;
  syncRuntimeEnabled: false;
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
  serviceRoleExposed: false;
  secretsExposed: false;
  nextPhase: '21B - Local Backup Dry Run UI V1';
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

const addReadinessBlockers = (
  blockers: Phase21aExplicitOptInSyncPreflightBlocker[],
  readiness: Phase20bSupabaseProjectRuntimeReadinessResult | null | undefined,
) => {
  if (readiness?.readyFor20C !== true) addUnique(blockers, 'phase20b_not_ready');
  if (readiness?.browserSafeConfigReady !== true) addUnique(blockers, 'browser_config_not_ready');
  if (Boolean(readiness?.serviceRoleExposed)) addUnique(blockers, 'service_role_exposed');
  if (Boolean(readiness?.secretsExposed)) addUnique(blockers, 'secret_exposed');
  if (Boolean(readiness?.syncRuntimeEnabled)) addUnique(blockers, 'sync_runtime_already_enabled');
  if (Boolean(readiness?.liveCloudSyncActivated)) addUnique(blockers, 'live_sync_already_active');
  if (Boolean(readiness?.cloudPrimaryEnabled)) addUnique(blockers, 'cloud_primary_enabled');
  if (Boolean(readiness?.defaultSyncEnabled)) addUnique(blockers, 'default_sync_enabled');
  if (Boolean(readiness?.backgroundWorkEnabled)) addUnique(blockers, 'background_work_enabled');
  if (Boolean(readiness?.sourceOfTruthChanged)) addUnique(blockers, 'source_of_truth_changed');
  if (Boolean(readiness?.localStorageDeleted)) addUnique(blockers, 'localStorage_deleted');
};

const addAuthBlockers = (
  blockers: Phase21aExplicitOptInSyncPreflightBlocker[],
  authRuntime: Phase21aAuthRuntimeEvidence | null | undefined,
) => {
  if (authRuntime?.readyFor20D !== true || authRuntime.authRuntimeEnabled !== true) {
    addUnique(blockers, 'auth_runtime_not_ready');
  }
  if (authRuntime?.authenticated !== true || !authRuntime.user?.userId || !authRuntime.user.accountId) {
    addUnique(blockers, 'authenticated_user_missing');
  }
  if (Boolean(authRuntime?.tokenStored)) addUnique(blockers, 'auth_token_storage_detected');
  if (Boolean(authRuntime?.localStorageChanged)) addUnique(blockers, 'auth_localStorage_changed');
  if (Boolean(authRuntime?.syncRuntimeEnabled)) addUnique(blockers, 'sync_runtime_already_enabled');
  if (Boolean(authRuntime?.liveCloudSyncActivated)) addUnique(blockers, 'live_sync_already_active');
  if (Boolean(authRuntime?.cloudPrimaryEnabled)) addUnique(blockers, 'cloud_primary_enabled');
  if (Boolean(authRuntime?.defaultSyncEnabled)) addUnique(blockers, 'default_sync_enabled');
  if (Boolean(authRuntime?.backgroundWorkEnabled)) addUnique(blockers, 'background_work_enabled');
  if (Boolean(authRuntime?.sourceOfTruthChanged)) addUnique(blockers, 'source_of_truth_changed');
  if (Boolean(authRuntime?.localStorageDeleted)) addUnique(blockers, 'localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase21aExplicitOptInSyncPreflightBlocker[],
  boundary: Partial<Phase21aRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasRuntimeBoundaryBlocker = (blockers: Phase21aExplicitOptInSyncPreflightBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'service_role_exposed' ||
    blocker === 'secret_exposed' ||
    blocker === 'auth_token_storage_detected' ||
    blocker === 'auth_localStorage_changed' ||
    blocker === 'sync_runtime_already_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21aExplicitOptInSyncPreflightBlocker[],
): Phase21aExplicitOptInSyncPreflightStatus => {
  if (blockers.includes('preflight_disabled')) return 'disabled';
  if (blockers.includes('phase20b_not_ready') || blockers.includes('browser_config_not_ready')) {
    return 'readiness_missing';
  }
  if (hasRuntimeBoundaryBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('auth_runtime_not_ready') || blockers.includes('authenticated_user_missing')) {
    return 'sign_in_required';
  }
  return 'ready_for_backup_dry_run';
};

export const buildExplicitOptInSyncPreflight = (
  input: Phase21aExplicitOptInSyncPreflightInput = {},
): Phase21aExplicitOptInSyncPreflightResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21aExplicitOptInSyncPreflightBlocker[] = [];
  const warnings: Phase21aExplicitOptInSyncPreflightWarning[] = [
    'manual_opt_in_required',
    'backup_required_before_first_upload',
    'dry_run_required_before_first_upload',
    'localStorage_remains_fallback',
    'no_silent_overwrite',
    'no_default_sync',
    'no_background_sync',
    'cloud_primary_not_enabled',
  ];

  if (input.enabled !== true) addUnique(blockers, 'preflight_disabled');
  addReadinessBlockers(blockers, input.readiness);
  addAuthBlockers(blockers, input.authRuntime);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const status = statusFromBlockers(blockers);
  const ok = status === 'ready_for_backup_dry_run';
  const user = ok && input.authRuntime?.user
    ? {
        userId: input.authRuntime.user.userId,
        accountId: input.authRuntime.user.accountId,
        displayName: input.authRuntime.user.displayName,
      }
    : null;

  return {
    id: input.preflightId ?? `${PHASE21A_EXPLICIT_OPT_IN_SYNC_PREFLIGHT_ID}-${hashText(createdAt)}`,
    baseId: PHASE21A_EXPLICIT_OPT_IN_SYNC_PREFLIGHT_ID,
    phase: '21A',
    ok,
    status,
    readyFor21B: ok,
    syncPreflightVisible: input.enabled === true,
    user,
    blockers,
    warnings,
    userMessage: '本地数据仍会保留',
    primaryActionLabel: '检查本地数据',
    secondaryActionLabels: ['开启前先备份', '查看将同步的内容'],
    requiresExplicitOptIn: true,
    requiresBackupBeforeFirstUpload: true,
    requiresDryRunBeforeFirstUpload: true,
    requiresManualConfirmationBeforeUpload: true,
    requiresConflictReviewBeforeApply: true,
    syncRuntimeEnabled: false,
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
    serviceRoleExposed: false,
    secretsExposed: false,
    nextPhase: '21B - Local Backup Dry Run UI V1',
    createdAt,
  };
};
