export const PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID =
  'phase19-production-manual-acceptance';

export type Phase19ProductionManualAcceptanceStatus =
  | 'disabled'
  | 'phase19k_acceptance_missing'
  | 'validation_missing'
  | 'manual_evidence_missing'
  | 'production_boundary_unsafe'
  | 'manual_acceptance_passed';

export type Phase19ProductionManualAcceptanceBlocker =
  | 'manual_acceptance_disabled'
  | 'phase19k_acceptance_missing'
  | 'upload_performed'
  | 'download_performed'
  | 'auto_apply_available'
  | 'local_data_changed'
  | 'cloud_data_changed'
  | 'source_of_truth_changed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
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

export type Phase19ProductionManualAcceptanceWarning =
  | 'manual_acceptance_only'
  | 'future_cloud_primary_requires_separate_decision'
  | 'localStorage_remains_fallback'
  | 'no_real_personal_data';

export type Phase19kAcceptanceLike = {
  acceptedForManualProductionReview: boolean;
  uploadPerformed: boolean;
  downloadPerformed: boolean;
  autoApplied: boolean;
  localDataChanged: boolean;
  cloudDataChanged: boolean;
  sourceOfTruthChanged: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  localStorageFallbackPreserved: boolean;
};

export type Phase19ValidationEvidence = {
  apiDevBuildPassed: boolean;
  typecheckPassed: boolean;
  testSuitePassed: boolean;
  productionBuildPassed: boolean;
  distTokenScanPassed: boolean;
  packageLockfileClean: boolean;
};

export type Phase19ManualEvidence = {
  dedicatedEnvironment: boolean;
  dedicatedBrowserProfile: boolean;
  syntheticDataOnly: boolean;
  backupExportVerified: boolean;
  rlsOwnershipVerified: boolean;
  serviceRoleBlockedFromBrowser: boolean;
  privacyExportDeleteDocumented: boolean;
  offlineTrainingVerified: boolean;
  rollbackVerified: boolean;
  emergencyLocalVerified: boolean;
  routeLockVerified: boolean;
};

export type Phase19ProductionBoundaryEvidence = {
  productionLaunchPerformed: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
};

export type Phase19ProductionManualAcceptanceInput = {
  enabled?: boolean;
  phase19kAcceptance?: Phase19kAcceptanceLike | null;
  validationEvidence?: Phase19ValidationEvidence | null;
  manualEvidence?: Phase19ManualEvidence | null;
  productionBoundary?: Phase19ProductionBoundaryEvidence | null;
  nowIso?: string;
  acceptanceId?: string;
};

export type Phase19ProductionManualAcceptanceResult = {
  id: string;
  baseId: typeof PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID;
  phase: '19L';
  ok: boolean;
  status: Phase19ProductionManualAcceptanceStatus;
  manualAcceptancePassed: boolean;
  readyForFutureCloudPrimaryConsideration: boolean;
  validationAccepted: boolean;
  privacyAccepted: boolean;
  fallbackAccepted: boolean;
  routeBoundaryAccepted: boolean;
  blockers: Phase19ProductionManualAcceptanceBlocker[];
  warnings: Phase19ProductionManualAcceptanceWarning[];
  productionLaunchPerformed: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  sourceOfTruthChanged: false;
  finalPhaseComplete: boolean;
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

const statusFromBlockers = (
  blockers: Phase19ProductionManualAcceptanceBlocker[],
): Phase19ProductionManualAcceptanceStatus => {
  if (blockers.includes('manual_acceptance_disabled')) return 'disabled';
  if (blockers.includes('phase19k_acceptance_missing')) return 'phase19k_acceptance_missing';
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
  ) return 'manual_evidence_missing';
  if (
    blockers.includes('production_launch_performed') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled') ||
    blockers.includes('source_of_truth_changed')
  ) return 'production_boundary_unsafe';
  return 'manual_acceptance_passed';
};

const addPhase19kBlockers = (
  blockers: Phase19ProductionManualAcceptanceBlocker[],
  acceptance: Phase19kAcceptanceLike | null | undefined,
) => {
  if (acceptance?.acceptedForManualProductionReview !== true) {
    addUnique(blockers, 'phase19k_acceptance_missing');
  }
  if (acceptance?.uploadPerformed === true) addUnique(blockers, 'upload_performed');
  if (acceptance?.downloadPerformed === true) addUnique(blockers, 'download_performed');
  if (acceptance?.autoApplied === true) addUnique(blockers, 'auto_apply_available');
  if (acceptance?.localDataChanged === true) addUnique(blockers, 'local_data_changed');
  if (acceptance?.cloudDataChanged === true) addUnique(blockers, 'cloud_data_changed');
  if (acceptance?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (acceptance?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (acceptance?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (acceptance?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (acceptance?.localStorageFallbackPreserved !== true) addUnique(blockers, 'localStorage_fallback_missing');
};

const addValidationBlockers = (
  blockers: Phase19ProductionManualAcceptanceBlocker[],
  evidence: Phase19ValidationEvidence | null | undefined,
) => {
  if (evidence?.apiDevBuildPassed !== true) addUnique(blockers, 'api_dev_build_missing');
  if (evidence?.typecheckPassed !== true) addUnique(blockers, 'typecheck_missing');
  if (evidence?.testSuitePassed !== true) addUnique(blockers, 'test_suite_missing');
  if (evidence?.productionBuildPassed !== true) addUnique(blockers, 'production_build_missing');
  if (evidence?.distTokenScanPassed !== true) addUnique(blockers, 'dist_scan_missing');
  if (evidence?.packageLockfileClean !== true) addUnique(blockers, 'package_lockfile_drift');
};

const addManualEvidenceBlockers = (
  blockers: Phase19ProductionManualAcceptanceBlocker[],
  evidence: Phase19ManualEvidence | null | undefined,
) => {
  if (evidence?.dedicatedEnvironment !== true) addUnique(blockers, 'dedicated_environment_missing');
  if (evidence?.dedicatedBrowserProfile !== true) addUnique(blockers, 'dedicated_browser_profile_missing');
  if (evidence?.syntheticDataOnly !== true) addUnique(blockers, 'synthetic_data_missing');
  if (evidence?.backupExportVerified !== true) addUnique(blockers, 'backup_export_missing');
  if (evidence?.rlsOwnershipVerified !== true) addUnique(blockers, 'rls_ownership_missing');
  if (evidence?.serviceRoleBlockedFromBrowser !== true) addUnique(blockers, 'service_role_boundary_missing');
  if (evidence?.privacyExportDeleteDocumented !== true) addUnique(blockers, 'privacy_export_delete_missing');
  if (evidence?.offlineTrainingVerified !== true) addUnique(blockers, 'offline_training_missing');
  if (evidence?.rollbackVerified !== true) addUnique(blockers, 'rollback_missing');
  if (evidence?.emergencyLocalVerified !== true) addUnique(blockers, 'emergency_local_missing');
  if (evidence?.routeLockVerified !== true) addUnique(blockers, 'route_lock_missing');
};

const addProductionBoundaryBlockers = (
  blockers: Phase19ProductionManualAcceptanceBlocker[],
  boundary: Phase19ProductionBoundaryEvidence | null | undefined,
) => {
  if (boundary?.productionLaunchPerformed === true) addUnique(blockers, 'production_launch_performed');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
};

export const buildPhase19ProductionManualAcceptance = (
  input: Phase19ProductionManualAcceptanceInput = {},
): Phase19ProductionManualAcceptanceResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase19ProductionManualAcceptanceBlocker[] = [];
  const warnings: Phase19ProductionManualAcceptanceWarning[] = [
    'manual_acceptance_only',
    'future_cloud_primary_requires_separate_decision',
    'localStorage_remains_fallback',
    'no_real_personal_data',
  ];

  if (input.enabled !== true) addUnique(blockers, 'manual_acceptance_disabled');
  addPhase19kBlockers(blockers, input.phase19kAcceptance);
  addValidationBlockers(blockers, input.validationEvidence);
  addManualEvidenceBlockers(blockers, input.manualEvidence);
  addProductionBoundaryBlockers(blockers, input.productionBoundary);

  const status = statusFromBlockers(blockers);
  const ok = status === 'manual_acceptance_passed';
  const manualEvidence = input.manualEvidence;

  return {
    id: input.acceptanceId ?? `${PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID}-${hashText(createdAt)}`,
    baseId: PHASE19_PRODUCTION_MANUAL_ACCEPTANCE_ID,
    phase: '19L',
    ok,
    status,
    manualAcceptancePassed: ok,
    readyForFutureCloudPrimaryConsideration: ok,
    validationAccepted:
      input.validationEvidence?.apiDevBuildPassed === true &&
      input.validationEvidence.typecheckPassed === true &&
      input.validationEvidence.testSuitePassed === true &&
      input.validationEvidence.productionBuildPassed === true &&
      input.validationEvidence.distTokenScanPassed === true &&
      input.validationEvidence.packageLockfileClean === true,
    privacyAccepted:
      manualEvidence?.syntheticDataOnly === true &&
      manualEvidence.rlsOwnershipVerified === true &&
      manualEvidence.serviceRoleBlockedFromBrowser === true &&
      manualEvidence.privacyExportDeleteDocumented === true,
    fallbackAccepted:
      manualEvidence?.backupExportVerified === true &&
      manualEvidence.offlineTrainingVerified === true &&
      manualEvidence.rollbackVerified === true &&
      manualEvidence.emergencyLocalVerified === true &&
      input.phase19kAcceptance?.localStorageFallbackPreserved === true,
    routeBoundaryAccepted: manualEvidence?.routeLockVerified === true,
    blockers,
    warnings,
    productionLaunchPerformed: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    finalPhaseComplete: ok,
    createdAt,
  };
};
