import {
  buildAccountBoundaryLocalInventory,
  type Phase19AccountBoundaryLocalInventory,
} from './accountBoundaryLocalInventory';
import type { Phase21aExplicitOptInSyncPreflightResult } from './explicitOptInSyncPreflight';
import type { AppData } from '../models/training-model';
import { exportAppData } from '../storage/backup';

export const PHASE21B_LOCAL_BACKUP_DRY_RUN_UI_ID =
  'phase21b-local-backup-dry-run-ui';

export type Phase21bLocalBackupDryRunUiStatus =
  | 'disabled'
  | 'preflight_not_ready'
  | 'backup_required'
  | 'backup_invalid'
  | 'backup_mismatch'
  | 'account_boundary_not_ready'
  | 'dry_run_not_requested'
  | 'dry_run_blocked'
  | 'runtime_boundary_unsafe'
  | 'ready_for_shadow_candidate';

export type Phase21bLocalBackupDryRunUiBlocker =
  | 'ui_disabled'
  | 'phase21a_not_ready'
  | 'signed_in_account_missing'
  | 'backup_export_confirmation_missing'
  | 'backup_missing'
  | 'backup_invalid'
  | 'backup_mismatch'
  | 'account_boundary_not_ready'
  | 'schema_invalid'
  | 'dry_run_request_missing'
  | 'sync_runtime_enabled'
  | 'live_sync_already_active'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted';

export type Phase21bLocalBackupDryRunUiWarning =
  | 'backup_required_before_first_upload'
  | 'dry_run_required_before_first_upload'
  | 'localStorage_remains_fallback'
  | 'no_upload_or_download'
  | 'no_silent_overwrite'
  | 'first_upload_confirmation_still_required'
  | 'cloud_primary_not_enabled';

export type Phase21bRuntimeBoundaryEvidence = {
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase21bDryRunPreviewItem = {
  label: string;
  value: string;
};

export type Phase21bDryRunPreview = {
  title: '查看将同步的内容';
  items: Phase21bDryRunPreviewItem[];
  sourceSnapshotHash: string | null;
  schemaVersion: number | null;
};

export type Phase21bLocalBackupDryRunUiInput<TAppData = AppData> = {
  enabled?: boolean;
  preflight?: Phase21aExplicitOptInSyncPreflightResult | null;
  appData?: TAppData | null;
  backupJson?: string | null;
  backupExportConfirmed?: boolean;
  dryRunRequested?: boolean;
  deviceId?: string;
  schemaValidator?: (appData: TAppData) => boolean;
  runtimeBoundary?: Partial<Phase21bRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  uiId?: string;
};

export type Phase21bBackupPreflight = {
  status: Phase19AccountBoundaryLocalInventory['backup']['status'];
  checked: boolean;
  backupSnapshotHash: string | null;
  matchesCurrentLocal: boolean | null;
  generatedInMemory: boolean;
  exportRequiredBeforeFirstSync: true;
};

export type Phase21bLocalBackupDryRunUiResult = {
  id: string;
  baseId: typeof PHASE21B_LOCAL_BACKUP_DRY_RUN_UI_ID;
  phase: '21B';
  ok: boolean;
  status: Phase21bLocalBackupDryRunUiStatus;
  readyFor21C: boolean;
  backupReady: boolean;
  dryRunReady: boolean;
  backupUiVisible: boolean;
  dryRunPreviewVisible: boolean;
  blockers: Phase21bLocalBackupDryRunUiBlocker[];
  warnings: Phase21bLocalBackupDryRunUiWarning[];
  userMessage: '本地数据仍会保留';
  primaryActionLabel: '开启前先备份';
  secondaryActionLabels: ['检查本地数据', '查看将同步的内容'];
  backup: Phase21bBackupPreflight;
  accountInventory: Phase19AccountBoundaryLocalInventory;
  dryRunPreview: Phase21bDryRunPreview;
  requiresExplicitOptIn: true;
  requiresBackupBeforeFirstUpload: true;
  requiresDryRunBeforeFirstUpload: true;
  requiresManualConfirmationBeforeUpload: true;
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
  nextPhase: '21C - Cloud Write Shadow Candidate V1';
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

const backupJsonForUi = <TAppData>(
  input: Phase21bLocalBackupDryRunUiInput<TAppData>,
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

const addPreflightBlockers = (
  blockers: Phase21bLocalBackupDryRunUiBlocker[],
  preflight: Phase21aExplicitOptInSyncPreflightResult | null | undefined,
) => {
  if (preflight?.readyFor21B !== true || preflight.ok !== true) addUnique(blockers, 'phase21a_not_ready');
  if (!preflight?.user?.userId || !preflight.user.accountId) addUnique(blockers, 'signed_in_account_missing');
  if (Boolean(preflight?.syncRuntimeEnabled)) addUnique(blockers, 'sync_runtime_enabled');
  if (Boolean(preflight?.liveCloudSyncActivated)) addUnique(blockers, 'live_sync_already_active');
  if (Boolean(preflight?.cloudPrimaryEnabled)) addUnique(blockers, 'cloud_primary_enabled');
  if (Boolean(preflight?.defaultSyncEnabled)) addUnique(blockers, 'default_sync_enabled');
  if (Boolean(preflight?.backgroundWorkEnabled)) addUnique(blockers, 'background_work_enabled');
  if (Boolean(preflight?.sourceOfTruthChanged)) addUnique(blockers, 'source_of_truth_changed');
  if (Boolean(preflight?.localStorageDeleted)) addUnique(blockers, 'localStorage_deleted');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase21bLocalBackupDryRunUiBlocker[],
  boundary: Partial<Phase21bRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_enabled');
  if (boundary?.liveCloudSyncActivated === true) addUnique(blockers, 'live_sync_already_active');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addInventoryBlockers = (
  blockers: Phase21bLocalBackupDryRunUiBlocker[],
  inventory: Phase19AccountBoundaryLocalInventory,
  backupWasProvided: boolean,
) => {
  if (!backupWasProvided) addUnique(blockers, 'backup_export_confirmation_missing');
  if (inventory.backup.status === 'missing') addUnique(blockers, 'backup_missing');
  if (inventory.backup.status === 'invalid') addUnique(blockers, 'backup_invalid');
  if (inventory.backup.status === 'mismatch') addUnique(blockers, 'backup_mismatch');
  if (!inventory.ok) addUnique(blockers, 'account_boundary_not_ready');
};

const hasUnsafeRuntimeBlocker = (blockers: Phase21bLocalBackupDryRunUiBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'sync_runtime_enabled' ||
    blocker === 'live_sync_already_active' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted'
  ));

const statusFromBlockers = (
  blockers: Phase21bLocalBackupDryRunUiBlocker[],
): Phase21bLocalBackupDryRunUiStatus => {
  if (blockers.includes('ui_disabled')) return 'disabled';
  if (hasUnsafeRuntimeBlocker(blockers)) return 'runtime_boundary_unsafe';
  if (blockers.includes('phase21a_not_ready') || blockers.includes('signed_in_account_missing')) {
    return 'preflight_not_ready';
  }
  if (blockers.includes('backup_missing') || blockers.includes('backup_export_confirmation_missing')) {
    return 'backup_required';
  }
  if (blockers.includes('backup_invalid')) return 'backup_invalid';
  if (blockers.includes('backup_mismatch')) return 'backup_mismatch';
  if (blockers.includes('account_boundary_not_ready')) return 'account_boundary_not_ready';
  if (blockers.includes('schema_invalid')) return 'dry_run_blocked';
  if (blockers.includes('dry_run_request_missing')) return 'dry_run_not_requested';
  return 'ready_for_shadow_candidate';
};

const countValue = (value: unknown): string =>
  Array.isArray(value) ? String(value.length) : '0';

const buildDryRunPreview = <TAppData>(
  appData: TAppData | null | undefined,
  inventory: Phase19AccountBoundaryLocalInventory,
): Phase21bDryRunPreview => {
  const data = appData as Partial<AppData> | null | undefined;
  const snapshotHash = inventory.appDataSummary?.sourceSnapshotHash ?? null;
  const schemaVersion = inventory.appDataSummary?.schemaVersion ?? null;

  return {
    title: '查看将同步的内容',
    sourceSnapshotHash: snapshotHash,
    schemaVersion,
    items: [
      { label: '训练记录', value: countValue(data?.history) },
      { label: '训练模板', value: countValue(data?.templates) },
      { label: '体重记录', value: countValue(data?.bodyWeights) },
      { label: '健康样本', value: countValue(data?.healthMetricSamples) },
      { label: '数据版本', value: schemaVersion == null ? '未确认' : String(schemaVersion) },
      { label: '本地指纹', value: snapshotHash ? snapshotHash.slice(0, 8) : '未确认' },
    ],
  };
};

export const buildLocalBackupDryRunUi = <TAppData = AppData>(
  input: Phase21bLocalBackupDryRunUiInput<TAppData> = {},
): Phase21bLocalBackupDryRunUiResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase21bLocalBackupDryRunUiBlocker[] = [];
  const warnings: Phase21bLocalBackupDryRunUiWarning[] = [
    'backup_required_before_first_upload',
    'dry_run_required_before_first_upload',
    'localStorage_remains_fallback',
    'no_upload_or_download',
    'no_silent_overwrite',
    'first_upload_confirmation_still_required',
    'cloud_primary_not_enabled',
  ];

  if (input.enabled !== true) addUnique(blockers, 'ui_disabled');
  addPreflightBlockers(blockers, input.preflight);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const backup = backupJsonForUi(input);
  const inventory = input.preflight?.user
    ? buildAccountBoundaryLocalInventory({
        appData: input.appData,
        backupJson: backup.backupJson,
        cloudAccountId: input.preflight.user.accountId,
        ownerUserId: input.preflight.user.userId,
        deviceId: input.deviceId,
        nowIso: createdAt,
      })
    : emptyInventory(createdAt);
  addInventoryBlockers(blockers, inventory, Boolean(backup.backupJson));

  const schemaValid =
    input.appData != null &&
    (input.schemaValidator ? input.schemaValidator(input.appData) !== false : true);
  if (input.dryRunRequested === true && !schemaValid) addUnique(blockers, 'schema_invalid');
  if (inventory.ok && input.dryRunRequested !== true) addUnique(blockers, 'dry_run_request_missing');

  const status = statusFromBlockers(blockers);
  const ok = status === 'ready_for_shadow_candidate';
  const backupReady = inventory.backup.status === 'valid' && inventory.backup.matchesCurrentLocal === true;
  const dryRunReady = ok;

  return {
    id: input.uiId ?? `${PHASE21B_LOCAL_BACKUP_DRY_RUN_UI_ID}-${hashText(createdAt)}`,
    baseId: PHASE21B_LOCAL_BACKUP_DRY_RUN_UI_ID,
    phase: '21B',
    ok,
    status,
    readyFor21C: ok,
    backupReady,
    dryRunReady,
    backupUiVisible: input.preflight?.syncPreflightVisible === true,
    dryRunPreviewVisible: input.dryRunRequested === true && backupReady && !blockers.includes('schema_invalid'),
    blockers,
    warnings,
    userMessage: '本地数据仍会保留',
    primaryActionLabel: '开启前先备份',
    secondaryActionLabels: ['检查本地数据', '查看将同步的内容'],
    backup: {
      status: inventory.backup.status,
      checked: inventory.backup.checked,
      backupSnapshotHash: inventory.backup.backupSnapshotHash,
      matchesCurrentLocal: inventory.backup.matchesCurrentLocal,
      generatedInMemory: backup.generatedInMemory,
      exportRequiredBeforeFirstSync: true,
    },
    accountInventory: inventory,
    dryRunPreview: buildDryRunPreview(input.appData, inventory),
    requiresExplicitOptIn: true,
    requiresBackupBeforeFirstUpload: true,
    requiresDryRunBeforeFirstUpload: true,
    requiresManualConfirmationBeforeUpload: true,
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
    nextPhase: '21C - Cloud Write Shadow Candidate V1',
    createdAt,
  };
};
