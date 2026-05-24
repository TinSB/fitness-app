import {
  buildPhase19ProductionManualAcceptance,
  type Phase19ManualEvidence,
  type Phase19ProductionManualAcceptanceResult,
  type Phase19ValidationEvidence,
} from './phase19ProductionManualAcceptance';
import type { Phase20gConflictOfflineRollbackResult } from './conflictOfflineRollbackRuntimeFlow';

export const PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID =
  'phase20h-production-acceptance-synthetic-data';

export type Phase20hProductionAcceptanceSyntheticStatus =
  | 'disabled'
  | 'phase20g_not_ready'
  | 'validation_missing'
  | 'synthetic_evidence_missing'
  | 'production_boundary_unsafe'
  | 'accepted_for_ui_polish_handoff';

export type Phase20hProductionAcceptanceSyntheticBlocker =
  | 'acceptance_disabled'
  | 'phase20g_not_ready'
  | 'upload_performed'
  | 'download_performed'
  | 'auto_apply_available'
  | 'local_data_changed'
  | 'source_of_truth_changed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'localStorage_deleted'
  | 'localStorage_fallback_missing'
  | 'api_dev_build_missing'
  | 'typecheck_missing'
  | 'test_suite_missing'
  | 'production_build_missing'
  | 'dist_scan_missing'
  | 'package_lockfile_drift'
  | 'dedicated_environment_missing'
  | 'dedicated_browser_profile_missing'
  | 'synthetic_data_missing'
  | 'backup_export_missing'
  | 'rls_ownership_missing'
  | 'service_role_boundary_missing'
  | 'privacy_export_delete_missing'
  | 'offline_training_missing'
  | 'rollback_missing'
  | 'emergency_local_missing'
  | 'route_lock_missing'
  | 'production_launch_performed';

export type Phase20hProductionAcceptanceSyntheticWarning =
  | 'synthetic_acceptance_only'
  | 'no_real_personal_data'
  | 'localStorage_remains_fallback'
  | 'cloud_primary_not_enabled'
  | 'ui_polish_handoff_next';

export type Phase20hProductionBoundaryEvidence = {
  productionLaunchPerformed?: boolean;
  cloudPrimaryEnabled?: boolean;
  defaultSyncEnabled?: boolean;
  backgroundWorkEnabled?: boolean;
  sourceOfTruthChanged?: boolean;
  localStorageDeleted?: boolean;
};

export type Phase20hProductionAcceptanceSyntheticInput<TAppData = unknown> = {
  enabled?: boolean;
  runtimeFlow?: Phase20gConflictOfflineRollbackResult | null;
  validationEvidence?: Phase19ValidationEvidence | null;
  manualEvidence?: Phase19ManualEvidence | null;
  productionBoundary?: Phase20hProductionBoundaryEvidence | null;
  nowIso?: string;
  acceptanceId?: string;
};

export type Phase20hProductionAcceptanceSyntheticResult = {
  id: string;
  baseId: typeof PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID;
  phase: '20H';
  ok: boolean;
  status: Phase20hProductionAcceptanceSyntheticStatus;
  readyFor20I: boolean;
  blockers: Phase20hProductionAcceptanceSyntheticBlocker[];
  warnings: Phase20hProductionAcceptanceSyntheticWarning[];
  userMessage: '合成数据验收完成';
  manualAcceptance: Phase19ProductionManualAcceptanceResult;
  validationAccepted: boolean;
  syntheticEvidenceAccepted: boolean;
  privacyAccepted: boolean;
  fallbackAccepted: boolean;
  routeBoundaryAccepted: boolean;
  cloudWriteCandidateAccepted: boolean;
  syncRuntimeEnabled: boolean;
  liveCloudSyncActivated: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  uploadPerformed: false;
  downloadPerformed: false;
  autoApplied: false;
  localDataChanged: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: boolean;
  productionLaunchPerformed: false;
  nextPhase: '20I - v0 UI Polish Handoff Contract V1';
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

const addRuntimeFlowBlockers = (
  blockers: Phase20hProductionAcceptanceSyntheticBlocker[],
  runtimeFlow: Phase20gConflictOfflineRollbackResult | null | undefined,
) => {
  if (runtimeFlow?.readyFor20H !== true || runtimeFlow.ok !== true) {
    addUnique(blockers, 'phase20g_not_ready');
  }
  if (runtimeFlow?.cloudWriteCandidateAccepted !== true) addUnique(blockers, 'phase20g_not_ready');
  if (runtimeFlow?.localStorageFallbackPreserved !== true) {
    addUnique(blockers, 'localStorage_fallback_missing');
  }
};

const addProductionBoundaryBlockers = (
  blockers: Phase20hProductionAcceptanceSyntheticBlocker[],
  boundary: Phase20hProductionBoundaryEvidence | null | undefined,
) => {
  if (boundary?.productionLaunchPerformed === true) addUnique(blockers, 'production_launch_performed');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const addManualAcceptanceBlockers = (
  blockers: Phase20hProductionAcceptanceSyntheticBlocker[],
  acceptance: Phase19ProductionManualAcceptanceResult,
) => {
  for (const blocker of acceptance.blockers) {
    if (blocker === 'manual_acceptance_disabled') addUnique(blockers, 'acceptance_disabled');
    if (blocker === 'phase19k_acceptance_missing') addUnique(blockers, 'phase20g_not_ready');
    if (blocker === 'upload_performed') addUnique(blockers, blocker);
    if (blocker === 'download_performed') addUnique(blockers, blocker);
    if (blocker === 'auto_apply_available') addUnique(blockers, blocker);
    if (blocker === 'local_data_changed') addUnique(blockers, blocker);
    if (blocker === 'source_of_truth_changed') addUnique(blockers, blocker);
    if (blocker === 'cloud_primary_enabled') addUnique(blockers, blocker);
    if (blocker === 'default_sync_enabled') addUnique(blockers, blocker);
    if (blocker === 'background_work_enabled') addUnique(blockers, blocker);
    if (blocker === 'localStorage_fallback_missing') addUnique(blockers, blocker);
    if (blocker === 'api_dev_build_missing') addUnique(blockers, blocker);
    if (blocker === 'typecheck_missing') addUnique(blockers, blocker);
    if (blocker === 'test_suite_missing') addUnique(blockers, blocker);
    if (blocker === 'production_build_missing') addUnique(blockers, blocker);
    if (blocker === 'dist_scan_missing') addUnique(blockers, blocker);
    if (blocker === 'package_lockfile_drift') addUnique(blockers, blocker);
    if (blocker === 'dedicated_environment_missing') addUnique(blockers, blocker);
    if (blocker === 'dedicated_browser_profile_missing') addUnique(blockers, blocker);
    if (blocker === 'synthetic_data_missing') addUnique(blockers, blocker);
    if (blocker === 'backup_export_missing') addUnique(blockers, blocker);
    if (blocker === 'rls_ownership_missing') addUnique(blockers, blocker);
    if (blocker === 'service_role_boundary_missing') addUnique(blockers, blocker);
    if (blocker === 'privacy_export_delete_missing') addUnique(blockers, blocker);
    if (blocker === 'offline_training_missing') addUnique(blockers, blocker);
    if (blocker === 'rollback_missing') addUnique(blockers, blocker);
    if (blocker === 'emergency_local_missing') addUnique(blockers, blocker);
    if (blocker === 'route_lock_missing') addUnique(blockers, blocker);
    if (blocker === 'production_launch_performed') addUnique(blockers, blocker);
  }
};

const statusFromBlockers = (
  blockers: Phase20hProductionAcceptanceSyntheticBlocker[],
): Phase20hProductionAcceptanceSyntheticStatus => {
  if (blockers.includes('acceptance_disabled')) return 'disabled';
  if (blockers.includes('phase20g_not_ready')) return 'phase20g_not_ready';
  if (
    blockers.includes('api_dev_build_missing') ||
    blockers.includes('typecheck_missing') ||
    blockers.includes('test_suite_missing') ||
    blockers.includes('production_build_missing') ||
    blockers.includes('dist_scan_missing') ||
    blockers.includes('package_lockfile_drift')
  ) return 'validation_missing';
  if (
    blockers.includes('dedicated_environment_missing') ||
    blockers.includes('dedicated_browser_profile_missing') ||
    blockers.includes('synthetic_data_missing') ||
    blockers.includes('backup_export_missing') ||
    blockers.includes('rls_ownership_missing') ||
    blockers.includes('service_role_boundary_missing') ||
    blockers.includes('privacy_export_delete_missing') ||
    blockers.includes('offline_training_missing') ||
    blockers.includes('rollback_missing') ||
    blockers.includes('emergency_local_missing') ||
    blockers.includes('route_lock_missing')
  ) return 'synthetic_evidence_missing';
  if (
    blockers.includes('production_launch_performed') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled') ||
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('localStorage_deleted') ||
    blockers.includes('localStorage_fallback_missing')
  ) return 'production_boundary_unsafe';
  return 'accepted_for_ui_polish_handoff';
};

export const buildProductionAcceptanceSyntheticData = <TAppData = unknown>(
  input: Phase20hProductionAcceptanceSyntheticInput<TAppData> = {},
): Phase20hProductionAcceptanceSyntheticResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20hProductionAcceptanceSyntheticBlocker[] = [];
  const warnings: Phase20hProductionAcceptanceSyntheticWarning[] = [
    'synthetic_acceptance_only',
    'no_real_personal_data',
    'localStorage_remains_fallback',
    'cloud_primary_not_enabled',
    'ui_polish_handoff_next',
  ];

  if (input.enabled !== true) addUnique(blockers, 'acceptance_disabled');
  addRuntimeFlowBlockers(blockers, input.runtimeFlow);
  addProductionBoundaryBlockers(blockers, input.productionBoundary);

  const manualAcceptance = buildPhase19ProductionManualAcceptance({
    enabled: input.enabled,
    phase19kAcceptance: {
      acceptedForManualProductionReview: input.runtimeFlow?.readyFor20H === true && input.runtimeFlow.ok === true,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      localStorageFallbackPreserved: input.runtimeFlow?.localStorageFallbackPreserved === true,
    },
    validationEvidence: input.validationEvidence,
    manualEvidence: input.manualEvidence,
    productionBoundary: {
      productionLaunchPerformed: input.productionBoundary?.productionLaunchPerformed === true,
      cloudPrimaryEnabled: input.productionBoundary?.cloudPrimaryEnabled === true,
      defaultSyncEnabled: input.productionBoundary?.defaultSyncEnabled === true,
      backgroundWorkEnabled: input.productionBoundary?.backgroundWorkEnabled === true,
      sourceOfTruthChanged: input.productionBoundary?.sourceOfTruthChanged === true,
    },
    nowIso: createdAt,
    acceptanceId: `phase20h-reused-${hashText(createdAt)}`,
  });
  addManualAcceptanceBlockers(blockers, manualAcceptance);

  const status = statusFromBlockers(blockers);
  const ok = status === 'accepted_for_ui_polish_handoff';

  return {
    id: input.acceptanceId ?? `${PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID}-${hashText(createdAt)}`,
    baseId: PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID,
    phase: '20H',
    ok,
    status,
    readyFor20I: ok,
    blockers,
    warnings,
    userMessage: '合成数据验收完成',
    manualAcceptance,
    validationAccepted: manualAcceptance.validationAccepted,
    syntheticEvidenceAccepted: input.manualEvidence?.syntheticDataOnly === true,
    privacyAccepted: manualAcceptance.privacyAccepted,
    fallbackAccepted: manualAcceptance.fallbackAccepted,
    routeBoundaryAccepted: manualAcceptance.routeBoundaryAccepted,
    cloudWriteCandidateAccepted: input.runtimeFlow?.cloudWriteCandidateAccepted === true,
    syncRuntimeEnabled: input.runtimeFlow?.syncRuntimeEnabled === true && !blockers.includes('phase20g_not_ready'),
    liveCloudSyncActivated: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    uploadPerformed: false,
    downloadPerformed: false,
    autoApplied: false,
    localDataChanged: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved:
      input.runtimeFlow?.localStorageFallbackPreserved === true &&
      input.manualEvidence?.backupExportVerified === true,
    productionLaunchPerformed: false,
    nextPhase: '20I - v0 UI Polish Handoff Contract V1',
    createdAt,
  };
};
