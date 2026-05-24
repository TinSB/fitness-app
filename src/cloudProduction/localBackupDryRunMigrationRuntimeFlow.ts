import {
  buildAccountBoundaryLocalInventory,
  type Phase19AccountBoundaryLocalInventory,
} from './accountBoundaryLocalInventory';
import {
  buildPhase19iLocalToCloudMigrationDryRun,
  type Phase19iLocalToCloudMigrationDryRunResult,
  type Phase19iReadMirrorLike,
} from './localToCloudMigrationDryRun';
import type { AppData } from '../models/training-model';
import { exportAppData } from '../storage/backup';

export const PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID =
  'phase20e-local-backup-dry-run-migration-runtime-flow';

export type Phase20eLocalBackupDryRunStatus =
  | 'disabled'
  | 'sync_runtime_not_ready'
  | 'backup_missing'
  | 'backup_invalid'
  | 'backup_mismatch'
  | 'account_boundary_not_ready'
  | 'dry_run_blocked'
  | 'manual_review_required'
  | 'ready_for_cloud_verification';

export type Phase20eLocalBackupDryRunBlocker =
  | 'flow_disabled'
  | 'sync_runtime_not_ready'
  | 'authenticated_user_missing'
  | 'backup_export_confirmation_missing'
  | 'backup_missing'
  | 'backup_invalid'
  | 'backup_mismatch'
  | 'account_boundary_not_ready'
  | 'schema_invalid'
  | 'cloud_repository_unavailable'
  | 'rls_preflight_failed'
  | 'cloud_conflict'
  | 'manual_review_required'
  | 'rollback_unavailable'
  | 'source_of_truth_changed'
  | 'localStorage_deleted'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled';

export type Phase20eLocalBackupDryRunWarning =
  | 'backup_metadata_only'
  | 'dry_run_only'
  | 'no_upload_or_download'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled'
  | 'manual_review_before_write';

export type Phase20eSyncRuntimeLike = {
  readyFor20E: boolean;
  syncRuntimeEnabled: boolean;
  user: {
    userId: string;
    accountId: string;
    displayName?: string;
  } | null;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20eLocalBackupDryRunInput<TAppData = AppData> = {
  enabled?: boolean;
  syncRuntime?: Phase20eSyncRuntimeLike | null;
  appData?: TAppData | null;
  backupJson?: string | null;
  backupExportConfirmed?: boolean;
  deviceId?: string;
  schemaValidator?: (appData: TAppData) => boolean;
  cloudRepositoryAvailable?: boolean;
  cloudReadMirror?: Phase19iReadMirrorLike | null;
  rlsPreflightPassed?: boolean;
  rollbackAvailable?: boolean;
  runtimeBoundary?: {
    cloudPrimaryEnabled?: boolean;
    defaultSyncEnabled?: boolean;
    backgroundWorkEnabled?: boolean;
    sourceOfTruthChanged?: boolean;
    localStorageDeleted?: boolean;
  } | null;
  nowIso?: string;
  operationId?: string;
  requestFingerprint?: string;
  flowId?: string;
};

export type Phase20eBackupPreflight = {
  status: Phase19AccountBoundaryLocalInventory['backup']['status'];
  checked: boolean;
  backupSnapshotHash: string | null;
  matchesCurrentLocal: boolean | null;
  generatedInMemory: boolean;
  exportRequiredBeforeFirstSync: true;
};

export type Phase20eLocalBackupDryRunResult = {
  id: string;
  baseId: typeof PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID;
  phase: '20E';
  ok: boolean;
  status: Phase20eLocalBackupDryRunStatus;
  readyFor20F: boolean;
  blockers: Phase20eLocalBackupDryRunBlocker[];
  warnings: Phase20eLocalBackupDryRunWarning[];
  userMessage: '本地数据仍会保留';
  backup: Phase20eBackupPreflight;
  accountInventory: Phase19AccountBoundaryLocalInventory;
  migrationDryRun: Phase19iLocalToCloudMigrationDryRunResult;
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
  nextPhase: '20F - Cloud Read/Write Verification Flow V1';
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

const emptyInventory = (createdAt: string): Phase19AccountBoundaryLocalInventory =>
  buildAccountBoundaryLocalInventory({ nowIso: createdAt });

const emptyDryRun = (createdAt: string): Phase19iLocalToCloudMigrationDryRunResult =>
  buildPhase19iLocalToCloudMigrationDryRun({ nowIso: createdAt });

const backupJsonForFlow = <TAppData>(
  input: Phase20eLocalBackupDryRunInput<TAppData>,
): { backupJson: string | null; generatedInMemory: boolean } => {
  if (input.backupJson?.trim()) return { backupJson: input.backupJson, generatedInMemory: false };
  if (input.backupExportConfirmed !== true || input.appData == null) {
    return { backupJson: null, generatedInMemory: false };
  }
  return {
    backupJson: exportAppData(input.appData as unknown as AppData),
    generatedInMemory: true,
  };
};

const addSyncRuntimeBlockers = (
  blockers: Phase20eLocalBackupDryRunBlocker[],
  syncRuntime: Phase20eSyncRuntimeLike | null | undefined,
) => {
  if (syncRuntime?.readyFor20E !== true || syncRuntime.syncRuntimeEnabled !== true) {
    addUnique(blockers, 'sync_runtime_not_ready');
  }
  if (!syncRuntime?.user?.userId || !syncRuntime.user.accountId) {
    addUnique(blockers, 'authenticated_user_missing');
  }
  if (syncRuntime?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (syncRuntime?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (syncRuntime?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (syncRuntime?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (syncRuntime?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20eLocalBackupDryRunBlocker[],
  boundary: Phase20eLocalBackupDryRunInput['runtimeBoundary'],
) => {
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addInventoryBlockers = (
  blockers: Phase20eLocalBackupDryRunBlocker[],
  inventory: Phase19AccountBoundaryLocalInventory,
  backupWasProvided: boolean,
) => {
  if (!backupWasProvided) addUnique(blockers, 'backup_export_confirmation_missing');
  if (inventory.backup.status === 'missing') addUnique(blockers, 'backup_missing');
  if (inventory.backup.status === 'invalid') addUnique(blockers, 'backup_invalid');
  if (inventory.backup.status === 'mismatch') addUnique(blockers, 'backup_mismatch');
  if (!inventory.ok) addUnique(blockers, 'account_boundary_not_ready');
};

const addDryRunBlockers = (
  blockers: Phase20eLocalBackupDryRunBlocker[],
  dryRun: Phase19iLocalToCloudMigrationDryRunResult,
) => {
  for (const blocker of dryRun.blockers) {
    if (blocker === 'schema_invalid') addUnique(blockers, 'schema_invalid');
    if (blocker === 'cloud_repository_unavailable') addUnique(blockers, 'cloud_repository_unavailable');
    if (blocker === 'rls_preflight_failed') addUnique(blockers, 'rls_preflight_failed');
    if (blocker === 'cloud_conflict') addUnique(blockers, 'cloud_conflict');
    if (blocker === 'manual_review_required') addUnique(blockers, 'manual_review_required');
    if (blocker === 'rollback_unavailable') addUnique(blockers, 'rollback_unavailable');
  }
};

const statusFromBlockers = (
  blockers: Phase20eLocalBackupDryRunBlocker[],
): Phase20eLocalBackupDryRunStatus => {
  if (blockers.includes('flow_disabled')) return 'disabled';
  if (blockers.includes('sync_runtime_not_ready') || blockers.includes('authenticated_user_missing')) {
    return 'sync_runtime_not_ready';
  }
  if (blockers.includes('backup_missing') || blockers.includes('backup_export_confirmation_missing')) {
    return 'backup_missing';
  }
  if (blockers.includes('backup_invalid')) return 'backup_invalid';
  if (blockers.includes('backup_mismatch')) return 'backup_mismatch';
  if (blockers.includes('account_boundary_not_ready')) return 'account_boundary_not_ready';
  if (blockers.includes('manual_review_required')) return 'manual_review_required';
  if (blockers.includes('cloud_conflict')) return 'manual_review_required';
  if (
    blockers.includes('schema_invalid') ||
    blockers.includes('cloud_repository_unavailable') ||
    blockers.includes('rls_preflight_failed') ||
    blockers.includes('rollback_unavailable') ||
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('localStorage_deleted') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled')
  ) {
    return 'dry_run_blocked';
  }
  return 'ready_for_cloud_verification';
};

export const buildLocalBackupDryRunMigrationRuntimeFlow = <TAppData = AppData>(
  input: Phase20eLocalBackupDryRunInput<TAppData> = {},
): Phase20eLocalBackupDryRunResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20eLocalBackupDryRunBlocker[] = [];
  const warnings: Phase20eLocalBackupDryRunWarning[] = [
    'backup_metadata_only',
    'dry_run_only',
    'no_upload_or_download',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
    'manual_review_before_write',
  ];

  if (input.enabled !== true) addUnique(blockers, 'flow_disabled');
  addSyncRuntimeBlockers(blockers, input.syncRuntime);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const backup = backupJsonForFlow(input);
  const accountInventory = input.syncRuntime?.user
    ? buildAccountBoundaryLocalInventory({
        appData: input.appData,
        backupJson: backup.backupJson,
        cloudAccountId: input.syncRuntime.user.accountId,
        ownerUserId: input.syncRuntime.user.userId,
        deviceId: input.deviceId,
        nowIso: createdAt,
      })
    : emptyInventory(createdAt);
  addInventoryBlockers(blockers, accountInventory, Boolean(backup.backupJson));

  const migrationDryRun = accountInventory.ok
    ? buildPhase19iLocalToCloudMigrationDryRun({
        enabled: true,
        accountInventory,
        appData: input.appData,
        schemaValidator: input.schemaValidator,
        cloudRepositoryAvailable: input.cloudRepositoryAvailable,
        cloudReadMirror: input.cloudReadMirror,
        rlsPreflightPassed: input.rlsPreflightPassed,
        rollbackAvailable: input.rollbackAvailable,
        nowIso: createdAt,
        operationId: input.operationId,
        requestFingerprint: input.requestFingerprint,
      })
    : emptyDryRun(createdAt);
  addDryRunBlockers(blockers, migrationDryRun);

  const status = statusFromBlockers(blockers);
  const ok = status === 'ready_for_cloud_verification';

  return {
    id: input.flowId ?? `${PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID}-${hashText(createdAt)}`,
    baseId: PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID,
    phase: '20E',
    ok,
    status,
    readyFor20F: ok,
    blockers,
    warnings,
    userMessage: '本地数据仍会保留',
    backup: {
      status: accountInventory.backup.status,
      checked: accountInventory.backup.checked,
      backupSnapshotHash: accountInventory.backup.backupSnapshotHash,
      matchesCurrentLocal: accountInventory.backup.matchesCurrentLocal,
      generatedInMemory: backup.generatedInMemory,
      exportRequiredBeforeFirstSync: true,
    },
    accountInventory,
    migrationDryRun,
    syncRuntimeEnabled: input.syncRuntime?.syncRuntimeEnabled === true && !blockers.includes('sync_runtime_not_ready'),
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
    nextPhase: '20F - Cloud Read/Write Verification Flow V1',
    createdAt,
  };
};
