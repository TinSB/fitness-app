import type { Phase20hProductionAcceptanceSyntheticResult } from './productionAcceptanceSyntheticData';

export const PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID =
  'phase20i-v0-ui-polish-handoff-contract';

export type Phase20iV0UiPolishSurfaceId =
  | 'auth_screen'
  | 'sync_status_center'
  | 'first_sync_flow'
  | 'conflict_review'
  | 'offline_recovery'
  | 'account_settings';

export type Phase20iV0UiPolishHandoffStatus =
  | 'disabled'
  | 'phase20h_not_ready'
  | 'handoff_boundary_missing'
  | 'scope_unsafe'
  | 'handoff_ready';

export type Phase20iV0UiPolishHandoffBlocker =
  | 'handoff_disabled'
  | 'phase20h_not_ready'
  | 'upload_performed'
  | 'download_performed'
  | 'auto_apply_available'
  | 'source_of_truth_changed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'localStorage_deleted'
  | 'production_launch_performed'
  | 'ui_polish_started'
  | 'business_logic_in_presentational_components'
  | 'stable_props_missing'
  | 'stable_testids_missing'
  | 'chinese_copy_missing'
  | 'forbidden_copy_present'
  | 'durable_apply_copy_present'
  | 'route_change_present'
  | 'schema_change_present'
  | 'persistence_change_present'
  | 'package_lockfile_drift';

export type Phase20iV0UiPolishHandoffWarning =
  | 'handoff_contract_only'
  | 'v0_polish_not_started'
  | 'business_logic_stays_outside_components'
  | 'localStorage_remains_fallback'
  | 'manual_conflict_review_required';

export type Phase20iV0UiPolishSurface = {
  id: Phase20iV0UiPolishSurfaceId;
  title: string;
  purpose: string;
  stableProps: string[];
  stableState: string[];
  stableDataTestIds: string[];
  copyExamples: string[];
  blockedCapabilities: string[];
};

export type Phase20iV0UiPolishHandoffBoundaryEvidence = {
  uiPolishStarted?: boolean;
  businessLogicInPresentationalComponents?: boolean;
  stablePropsDocumented?: boolean;
  stableDataTestIdsDocumented?: boolean;
  chineseFirstCopyConfirmed?: boolean;
  forbiddenCopyAbsent?: boolean;
  durableApplyCopyAbsent?: boolean;
  routeChangePresent?: boolean;
  schemaChangePresent?: boolean;
  persistenceChangePresent?: boolean;
  packageLockfileChanged?: boolean;
  cloudPrimaryEnabled?: boolean;
  defaultSyncEnabled?: boolean;
  backgroundWorkEnabled?: boolean;
  sourceOfTruthChanged?: boolean;
  localStorageDeleted?: boolean;
};

export type Phase20iV0UiPolishHandoffInput = {
  enabled?: boolean;
  productionAcceptance?: Phase20hProductionAcceptanceSyntheticResult | null;
  handoffBoundary?: Phase20iV0UiPolishHandoffBoundaryEvidence | null;
  nowIso?: string;
  handoffId?: string;
};

export type Phase20iV0UiPolishHandoffContract = {
  id: string;
  baseId: typeof PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID;
  phase: '20I';
  ok: boolean;
  status: Phase20iV0UiPolishHandoffStatus;
  readyForV0UiPolish: boolean;
  phase20SequenceComplete: boolean;
  blockers: Phase20iV0UiPolishHandoffBlocker[];
  warnings: Phase20iV0UiPolishHandoffWarning[];
  userMessage: '界面打磨交接已准备';
  productionAccepted: boolean;
  stablePropsReady: boolean;
  stableDataTestIdsReady: boolean;
  copyReady: boolean;
  boundarySafe: boolean;
  surfaces: Phase20iV0UiPolishSurface[];
  copyExamples: string[];
  blockedCapabilities: string[];
  syncRuntimeEnabled: boolean;
  uiPolishStarted: false;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: boolean;
  productionLaunchPerformed: false;
  nextPhase: 'v0 UI Polish may start in a separate design task';
  createdAt: string;
};

const COPY_EXAMPLES = [
  '登录账号',
  '开启同步',
  '本地数据仍会保留',
  '开启前先备份',
  '不会自动覆盖本地训练记录',
  '查看冲突',
  '保留本地',
  '使用云端',
  '稍后再说',
  '退出登录',
] as const;

const BLOCKED_CAPABILITIES = [
  '不默认开启同步',
  '不启动后台任务',
  '不覆盖本地训练记录',
  '不删除本地数据',
  '不切换云端为默认来源',
  '不加入团队或教练功能',
] as const;

const SURFACES: Phase20iV0UiPolishSurface[] = [
  {
    id: 'auth_screen',
    title: '登录账号',
    purpose: 'polish login account entry while keeping auth actions injected by runtime state',
    stableProps: ['authStatus', 'currentUserEmail', 'isSigningIn', 'errorMessage', 'onSignIn', 'onSignOut'],
    stableState: ['signed_out', 'signing_in', 'signed_in', 'error'],
    stableDataTestIds: ['ironpath-auth-card', 'ironpath-auth-sign-in', 'ironpath-auth-sign-out', 'ironpath-auth-status'],
    copyExamples: ['登录账号', '退出登录', '稍后再说'],
    blockedCapabilities: ['不保存密钥', '不改变本地数据'],
  },
  {
    id: 'sync_status_center',
    title: '同步状态',
    purpose: 'polish sync status center around explicit opt-in readiness and verification evidence',
    stableProps: ['syncRuntimeEnabled', 'readinessStatus', 'lastVerificationAt', 'blockers', 'warnings'],
    stableState: ['not_enabled', 'ready', 'needs_review', 'unavailable'],
    stableDataTestIds: ['ironpath-sync-status-center', 'ironpath-sync-status-pill', 'ironpath-sync-status-message'],
    copyExamples: ['开启同步', '本地数据仍会保留', '不会自动覆盖本地训练记录'],
    blockedCapabilities: ['不默认开启同步', '不启动后台任务'],
  },
  {
    id: 'first_sync_flow',
    title: '首次同步',
    purpose: 'polish backup-first and dry-run-first flow without changing data',
    stableProps: ['backupReady', 'dryRunReady', 'explicitOptIn', 'canVerify', 'onStartDryRun'],
    stableState: ['needs_backup', 'needs_dry_run', 'ready_to_verify', 'blocked'],
    stableDataTestIds: ['ironpath-first-sync-flow', 'ironpath-backup-before-sync', 'ironpath-dry-run-before-sync'],
    copyExamples: ['开启前先备份', '本地数据仍会保留', '查看后再决定'],
    blockedCapabilities: ['不上传真实训练数据作为默认行为', '不覆盖本地训练记录'],
  },
  {
    id: 'conflict_review',
    title: '查看冲突',
    purpose: 'polish manual conflict review with explicit local or cloud choices',
    stableProps: ['conflictCount', 'conflictItems', 'selectedResolution', 'onKeepLocal', 'onUseCloud'],
    stableState: ['none', 'review_required', 'local_selected', 'cloud_selected'],
    stableDataTestIds: ['ironpath-conflict-review', 'ironpath-conflict-keep-local', 'ironpath-conflict-use-cloud'],
    copyExamples: ['查看冲突', '保留本地', '使用云端'],
    blockedCapabilities: ['不静默选择冲突结果', '不直接覆盖本地训练记录'],
  },
  {
    id: 'offline_recovery',
    title: '离线与恢复',
    purpose: 'polish offline and rollback states while local training remains available',
    stableProps: ['offlineAvailable', 'cloudUnavailable', 'rollbackAvailable', 'emergencyLocalAvailable', 'onUseLocal'],
    stableState: ['online', 'offline_available', 'cloud_unavailable', 'rollback_available'],
    stableDataTestIds: ['ironpath-offline-recovery', 'ironpath-use-local', 'ironpath-rollback-status'],
    copyExamples: ['本地数据仍会保留', '稍后再说', '保留本地'],
    blockedCapabilities: ['不显示假成功', '不启动离线写入队列'],
  },
  {
    id: 'account_settings',
    title: '账号设置',
    purpose: 'polish account settings for sign-out, local backup status, and sync opt-in status',
    stableProps: ['accountEmail', 'syncOptIn', 'localBackupAvailable', 'serviceRoleExposed', 'onSignOut'],
    stableState: ['signed_in', 'sync_off', 'sync_opted_in', 'needs_backup'],
    stableDataTestIds: ['ironpath-account-settings', 'ironpath-account-email', 'ironpath-account-sign-out'],
    copyExamples: ['退出登录', '本地数据仍会保留', '开启前先备份'],
    blockedCapabilities: ['不显示管理后台', '不加入团队或教练功能'],
  },
];

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

const flagIsTrue = (value: unknown) => value === true;

const cloneSurfaces = (): Phase20iV0UiPolishSurface[] =>
  SURFACES.map((surface) => ({
    ...surface,
    stableProps: [...surface.stableProps],
    stableState: [...surface.stableState],
    stableDataTestIds: [...surface.stableDataTestIds],
    copyExamples: [...surface.copyExamples],
    blockedCapabilities: [...surface.blockedCapabilities],
  }));

const addProductionAcceptanceBlockers = (
  blockers: Phase20iV0UiPolishHandoffBlocker[],
  acceptance: Phase20hProductionAcceptanceSyntheticResult | null | undefined,
) => {
  if (acceptance?.ok !== true || acceptance.readyFor20I !== true) {
    addUnique(blockers, 'phase20h_not_ready');
  }
  if (acceptance?.validationAccepted !== true) addUnique(blockers, 'phase20h_not_ready');
  if (acceptance?.syntheticEvidenceAccepted !== true) addUnique(blockers, 'phase20h_not_ready');
  if (acceptance?.privacyAccepted !== true) addUnique(blockers, 'phase20h_not_ready');
  if (acceptance?.fallbackAccepted !== true) addUnique(blockers, 'phase20h_not_ready');
  if (acceptance?.routeBoundaryAccepted !== true) addUnique(blockers, 'phase20h_not_ready');
  if (acceptance?.localStorageFallbackPreserved !== true) addUnique(blockers, 'phase20h_not_ready');

  if (flagIsTrue(acceptance?.uploadPerformed)) addUnique(blockers, 'upload_performed');
  if (flagIsTrue(acceptance?.downloadPerformed)) addUnique(blockers, 'download_performed');
  if (flagIsTrue(acceptance?.autoApplied)) addUnique(blockers, 'auto_apply_available');
  if (flagIsTrue(acceptance?.sourceOfTruthChanged)) addUnique(blockers, 'source_of_truth_changed');
  if (flagIsTrue(acceptance?.cloudPrimaryEnabled)) addUnique(blockers, 'cloud_primary_enabled');
  if (flagIsTrue(acceptance?.defaultSyncEnabled)) addUnique(blockers, 'default_sync_enabled');
  if (flagIsTrue(acceptance?.backgroundWorkEnabled)) addUnique(blockers, 'background_work_enabled');
  if (flagIsTrue(acceptance?.localStorageDeleted)) addUnique(blockers, 'localStorage_deleted');
  if (flagIsTrue(acceptance?.productionLaunchPerformed)) addUnique(blockers, 'production_launch_performed');
};

const addHandoffBoundaryBlockers = (
  blockers: Phase20iV0UiPolishHandoffBlocker[],
  boundary: Phase20iV0UiPolishHandoffBoundaryEvidence | null | undefined,
) => {
  if (boundary?.uiPolishStarted === true) addUnique(blockers, 'ui_polish_started');
  if (boundary?.businessLogicInPresentationalComponents === true) {
    addUnique(blockers, 'business_logic_in_presentational_components');
  }
  if (boundary?.stablePropsDocumented !== true) addUnique(blockers, 'stable_props_missing');
  if (boundary?.stableDataTestIdsDocumented !== true) addUnique(blockers, 'stable_testids_missing');
  if (boundary?.chineseFirstCopyConfirmed !== true) addUnique(blockers, 'chinese_copy_missing');
  if (boundary?.forbiddenCopyAbsent !== true) addUnique(blockers, 'forbidden_copy_present');
  if (boundary?.durableApplyCopyAbsent !== true) addUnique(blockers, 'durable_apply_copy_present');
  if (boundary?.routeChangePresent === true) addUnique(blockers, 'route_change_present');
  if (boundary?.schemaChangePresent === true) addUnique(blockers, 'schema_change_present');
  if (boundary?.persistenceChangePresent === true) addUnique(blockers, 'persistence_change_present');
  if (boundary?.packageLockfileChanged === true) addUnique(blockers, 'package_lockfile_drift');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasScopeBlocker = (blockers: Phase20iV0UiPolishHandoffBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'ui_polish_started' ||
    blocker === 'business_logic_in_presentational_components' ||
    blocker === 'route_change_present' ||
    blocker === 'schema_change_present' ||
    blocker === 'persistence_change_present' ||
    blocker === 'package_lockfile_drift' ||
    blocker === 'cloud_primary_enabled' ||
    blocker === 'default_sync_enabled' ||
    blocker === 'background_work_enabled' ||
    blocker === 'source_of_truth_changed' ||
    blocker === 'localStorage_deleted' ||
    blocker === 'production_launch_performed'
  ));

const hasHandoffBoundaryBlocker = (blockers: Phase20iV0UiPolishHandoffBlocker[]) =>
  blockers.some((blocker) => (
    blocker === 'stable_props_missing' ||
    blocker === 'stable_testids_missing' ||
    blocker === 'chinese_copy_missing' ||
    blocker === 'forbidden_copy_present' ||
    blocker === 'durable_apply_copy_present'
  ));

const statusFromBlockers = (
  blockers: Phase20iV0UiPolishHandoffBlocker[],
): Phase20iV0UiPolishHandoffStatus => {
  if (blockers.includes('handoff_disabled')) return 'disabled';
  if (
    blockers.includes('phase20h_not_ready') ||
    blockers.includes('upload_performed') ||
    blockers.includes('download_performed') ||
    blockers.includes('auto_apply_available')
  ) return 'phase20h_not_ready';
  if (hasScopeBlocker(blockers)) return 'scope_unsafe';
  if (hasHandoffBoundaryBlocker(blockers)) return 'handoff_boundary_missing';
  return 'handoff_ready';
};

export const buildV0UiPolishHandoffContract = (
  input: Phase20iV0UiPolishHandoffInput = {},
): Phase20iV0UiPolishHandoffContract => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20iV0UiPolishHandoffBlocker[] = [];
  const warnings: Phase20iV0UiPolishHandoffWarning[] = [
    'handoff_contract_only',
    'v0_polish_not_started',
    'business_logic_stays_outside_components',
    'localStorage_remains_fallback',
    'manual_conflict_review_required',
  ];

  if (input.enabled !== true) addUnique(blockers, 'handoff_disabled');
  addProductionAcceptanceBlockers(blockers, input.productionAcceptance);
  addHandoffBoundaryBlockers(blockers, input.handoffBoundary);

  const status = statusFromBlockers(blockers);
  const ok = status === 'handoff_ready';

  return {
    id: input.handoffId ?? `${PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID}-${hashText(createdAt)}`,
    baseId: PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID,
    phase: '20I',
    ok,
    status,
    readyForV0UiPolish: ok,
    phase20SequenceComplete: ok,
    blockers,
    warnings,
    userMessage: '界面打磨交接已准备',
    productionAccepted:
      input.productionAcceptance?.ok === true &&
      input.productionAcceptance.readyFor20I === true &&
      !blockers.includes('phase20h_not_ready'),
    stablePropsReady:
      input.handoffBoundary?.stablePropsDocumented === true &&
      input.handoffBoundary.businessLogicInPresentationalComponents !== true,
    stableDataTestIdsReady: input.handoffBoundary?.stableDataTestIdsDocumented === true,
    copyReady:
      input.handoffBoundary?.chineseFirstCopyConfirmed === true &&
      input.handoffBoundary.forbiddenCopyAbsent === true &&
      input.handoffBoundary.durableApplyCopyAbsent === true,
    boundarySafe: !hasScopeBlocker(blockers),
    surfaces: cloneSurfaces(),
    copyExamples: [...COPY_EXAMPLES],
    blockedCapabilities: [...BLOCKED_CAPABILITIES],
    syncRuntimeEnabled: ok && input.productionAcceptance?.syncRuntimeEnabled === true,
    uiPolishStarted: false,
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: input.productionAcceptance?.localStorageFallbackPreserved === true,
    productionLaunchPerformed: false,
    nextPhase: 'v0 UI Polish may start in a separate design task',
    createdAt,
  };
};
