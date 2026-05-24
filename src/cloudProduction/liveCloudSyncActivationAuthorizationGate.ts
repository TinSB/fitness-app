export const PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID =
  'phase20a-live-cloud-sync-activation-authorization-gate';

export const PHASE20A_AUTHORIZED_RUNTIME_SEQUENCE = [
  '20B - Supabase Project Env & Runtime Readiness Check V1',
  '20C - Auth Runtime Wiring V1',
  '20D - Explicit Opt-In Sync Runtime Wiring V1',
  '20E - Local Backup + Dry-Run Migration Runtime Flow V1',
  '20F - Cloud Read/Write Verification Flow V1',
  '20G - Conflict/Offline/Rollback Runtime Flow V1',
  '20H - Production Acceptance With Synthetic Data V1',
  '20I - v0 UI Polish Handoff Contract V1',
] as const;

export type Phase20aAuthorizedRuntimePhase =
  typeof PHASE20A_AUTHORIZED_RUNTIME_SEQUENCE[number];

export type Phase20aLiveCloudSyncActivationAuthorizationStatus =
  | 'disabled'
  | 'phase19_acceptance_missing'
  | 'activation_intent_missing'
  | 'safety_confirmation_missing'
  | 'boundary_unsafe'
  | 'authorized_for_runtime_sequence';

export type Phase20aLiveCloudSyncActivationAuthorizationBlocker =
  | 'authorization_disabled'
  | 'phase19_manual_acceptance_missing'
  | 'phase19_future_consideration_missing'
  | 'phase19_validation_missing'
  | 'phase19_privacy_missing'
  | 'phase19_fallback_missing'
  | 'phase19_route_boundary_missing'
  | 'manual_activation_intent_missing'
  | 'single_user_scope_missing'
  | 'localStorage_fallback_missing'
  | 'no_default_sync_missing'
  | 'no_background_work_missing'
  | 'no_silent_overwrite_missing'
  | 'no_service_role_browser_missing'
  | 'no_saas_scope_missing'
  | 'local_backup_required_missing'
  | 'dry_run_required_missing'
  | 'production_launch_performed'
  | 'cloud_primary_enabled'
  | 'default_sync_enabled'
  | 'background_work_enabled'
  | 'source_of_truth_changed'
  | 'localStorage_deleted'
  | 'auth_runtime_already_enabled'
  | 'sync_runtime_already_enabled';

export type Phase20aLiveCloudSyncActivationAuthorizationWarning =
  | 'authorization_gate_only'
  | 'runtime_sequence_requires_separate_prs'
  | 'localStorage_remains_fallback'
  | 'manual_opt_in_required'
  | 'no_default_or_background_work';

export type Phase20aPhase19AcceptanceLike = {
  manualAcceptancePassed: boolean;
  readyForFutureCloudPrimaryConsideration: boolean;
  validationAccepted: boolean;
  privacyAccepted: boolean;
  fallbackAccepted: boolean;
  routeBoundaryAccepted: boolean;
  productionLaunchPerformed: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
};

export type Phase20aSafetyConfirmation = {
  manualActivationIntent: boolean;
  singleUserScopeConfirmed: boolean;
  localStorageFallbackConfirmed: boolean;
  noDefaultSyncConfirmed: boolean;
  noBackgroundWorkConfirmed: boolean;
  noSilentOverwriteConfirmed: boolean;
  noServiceRoleInBrowserConfirmed: boolean;
  noSaasScopeConfirmed: boolean;
  localBackupRequiredConfirmed: boolean;
  dryRunRequiredConfirmed: boolean;
};

export type Phase20aRuntimeBoundaryEvidence = {
  authRuntimeEnabled: boolean;
  syncRuntimeEnabled: boolean;
  productionLaunchPerformed: boolean;
  cloudPrimaryEnabled: boolean;
  defaultSyncEnabled: boolean;
  backgroundWorkEnabled: boolean;
  sourceOfTruthChanged: boolean;
  localStorageDeleted: boolean;
};

export type Phase20aLiveCloudSyncActivationAuthorizationInput = {
  enabled?: boolean;
  phase19Acceptance?: Phase20aPhase19AcceptanceLike | null;
  safetyConfirmation?: Partial<Phase20aSafetyConfirmation> | null;
  runtimeBoundary?: Partial<Phase20aRuntimeBoundaryEvidence> | null;
  nowIso?: string;
  authorizationId?: string;
};

export type Phase20aLiveCloudSyncActivationAuthorizationResult = {
  id: string;
  baseId: typeof PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID;
  phase: '20A';
  ok: boolean;
  status: Phase20aLiveCloudSyncActivationAuthorizationStatus;
  runtimeImplementationAuthorized: boolean;
  canStart20B: boolean;
  authorizedPhases: Phase20aAuthorizedRuntimePhase[];
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[];
  warnings: Phase20aLiveCloudSyncActivationAuthorizationWarning[];
  phase19Accepted: boolean;
  safetyConfirmed: boolean;
  boundarySafe: boolean;
  requiresExplicitOptIn: true;
  requiresLocalBackupBeforeSync: true;
  requiresDryRunBeforeWrite: true;
  liveCloudSyncActivated: false;
  authRuntimeEnabled: false;
  syncRuntimeEnabled: false;
  productionLaunchPerformed: false;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  sourceOfTruthChanged: false;
  localStorageDeleted: false;
  localStorageFallbackPreserved: boolean;
  nextPhase: '20B - Supabase Project Env & Runtime Readiness Check V1';
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
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[],
): Phase20aLiveCloudSyncActivationAuthorizationStatus => {
  if (blockers.includes('authorization_disabled')) return 'disabled';
  if (
    blockers.includes('phase19_manual_acceptance_missing') ||
    blockers.includes('phase19_future_consideration_missing') ||
    blockers.includes('phase19_validation_missing') ||
    blockers.includes('phase19_privacy_missing') ||
    blockers.includes('phase19_fallback_missing') ||
    blockers.includes('phase19_route_boundary_missing')
  ) return 'phase19_acceptance_missing';
  if (blockers.includes('manual_activation_intent_missing')) return 'activation_intent_missing';
  if (
    blockers.includes('single_user_scope_missing') ||
    blockers.includes('localStorage_fallback_missing') ||
    blockers.includes('no_default_sync_missing') ||
    blockers.includes('no_background_work_missing') ||
    blockers.includes('no_silent_overwrite_missing') ||
    blockers.includes('no_service_role_browser_missing') ||
    blockers.includes('no_saas_scope_missing') ||
    blockers.includes('local_backup_required_missing') ||
    blockers.includes('dry_run_required_missing')
  ) return 'safety_confirmation_missing';
  if (
    blockers.includes('production_launch_performed') ||
    blockers.includes('cloud_primary_enabled') ||
    blockers.includes('default_sync_enabled') ||
    blockers.includes('background_work_enabled') ||
    blockers.includes('source_of_truth_changed') ||
    blockers.includes('localStorage_deleted') ||
    blockers.includes('auth_runtime_already_enabled') ||
    blockers.includes('sync_runtime_already_enabled')
  ) return 'boundary_unsafe';
  return 'authorized_for_runtime_sequence';
};

const addPhase19Blockers = (
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[],
  phase19: Phase20aPhase19AcceptanceLike | null | undefined,
) => {
  if (phase19?.manualAcceptancePassed !== true) {
    addUnique(blockers, 'phase19_manual_acceptance_missing');
  }
  if (phase19?.readyForFutureCloudPrimaryConsideration !== true) {
    addUnique(blockers, 'phase19_future_consideration_missing');
  }
  if (phase19?.validationAccepted !== true) addUnique(blockers, 'phase19_validation_missing');
  if (phase19?.privacyAccepted !== true) addUnique(blockers, 'phase19_privacy_missing');
  if (phase19?.fallbackAccepted !== true) addUnique(blockers, 'phase19_fallback_missing');
  if (phase19?.routeBoundaryAccepted !== true) addUnique(blockers, 'phase19_route_boundary_missing');
  if (phase19?.productionLaunchPerformed === true) addUnique(blockers, 'production_launch_performed');
  if (phase19?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (phase19?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (phase19?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (phase19?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
};

const addSafetyBlockers = (
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[],
  safety: Partial<Phase20aSafetyConfirmation> | null | undefined,
) => {
  if (safety?.manualActivationIntent !== true) {
    addUnique(blockers, 'manual_activation_intent_missing');
  }
  if (safety?.singleUserScopeConfirmed !== true) addUnique(blockers, 'single_user_scope_missing');
  if (safety?.localStorageFallbackConfirmed !== true) addUnique(blockers, 'localStorage_fallback_missing');
  if (safety?.noDefaultSyncConfirmed !== true) addUnique(blockers, 'no_default_sync_missing');
  if (safety?.noBackgroundWorkConfirmed !== true) addUnique(blockers, 'no_background_work_missing');
  if (safety?.noSilentOverwriteConfirmed !== true) addUnique(blockers, 'no_silent_overwrite_missing');
  if (safety?.noServiceRoleInBrowserConfirmed !== true) {
    addUnique(blockers, 'no_service_role_browser_missing');
  }
  if (safety?.noSaasScopeConfirmed !== true) addUnique(blockers, 'no_saas_scope_missing');
  if (safety?.localBackupRequiredConfirmed !== true) addUnique(blockers, 'local_backup_required_missing');
  if (safety?.dryRunRequiredConfirmed !== true) addUnique(blockers, 'dry_run_required_missing');
};

const addRuntimeBoundaryBlockers = (
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[],
  boundary: Partial<Phase20aRuntimeBoundaryEvidence> | null | undefined,
) => {
  if (boundary?.authRuntimeEnabled === true) addUnique(blockers, 'auth_runtime_already_enabled');
  if (boundary?.syncRuntimeEnabled === true) addUnique(blockers, 'sync_runtime_already_enabled');
  if (boundary?.productionLaunchPerformed === true) addUnique(blockers, 'production_launch_performed');
  if (boundary?.cloudPrimaryEnabled === true) addUnique(blockers, 'cloud_primary_enabled');
  if (boundary?.defaultSyncEnabled === true) addUnique(blockers, 'default_sync_enabled');
  if (boundary?.backgroundWorkEnabled === true) addUnique(blockers, 'background_work_enabled');
  if (boundary?.sourceOfTruthChanged === true) addUnique(blockers, 'source_of_truth_changed');
  if (boundary?.localStorageDeleted === true) addUnique(blockers, 'localStorage_deleted');
};

const hasOnlySafeBoundaryValues = (
  blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[],
) => !blockers.some((blocker) => (
  blocker === 'production_launch_performed' ||
  blocker === 'cloud_primary_enabled' ||
  blocker === 'default_sync_enabled' ||
  blocker === 'background_work_enabled' ||
  blocker === 'source_of_truth_changed' ||
  blocker === 'localStorage_deleted' ||
  blocker === 'auth_runtime_already_enabled' ||
  blocker === 'sync_runtime_already_enabled'
));

export const buildLiveCloudSyncActivationAuthorizationGate = (
  input: Phase20aLiveCloudSyncActivationAuthorizationInput = {},
): Phase20aLiveCloudSyncActivationAuthorizationResult => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockers: Phase20aLiveCloudSyncActivationAuthorizationBlocker[] = [];
  const warnings: Phase20aLiveCloudSyncActivationAuthorizationWarning[] = [
    'authorization_gate_only',
    'runtime_sequence_requires_separate_prs',
    'localStorage_remains_fallback',
    'manual_opt_in_required',
    'no_default_or_background_work',
  ];

  if (input.enabled !== true) addUnique(blockers, 'authorization_disabled');
  addPhase19Blockers(blockers, input.phase19Acceptance);
  addSafetyBlockers(blockers, input.safetyConfirmation);
  addRuntimeBoundaryBlockers(blockers, input.runtimeBoundary);

  const status = statusFromBlockers(blockers);
  const ok = status === 'authorized_for_runtime_sequence';

  return {
    id: input.authorizationId ??
      `${PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID}-${hashText(createdAt)}`,
    baseId: PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID,
    phase: '20A',
    ok,
    status,
    runtimeImplementationAuthorized: ok,
    canStart20B: ok,
    authorizedPhases: ok ? [...PHASE20A_AUTHORIZED_RUNTIME_SEQUENCE] : [],
    blockers,
    warnings,
    phase19Accepted: !blockers.some((blocker) => blocker.startsWith('phase19_')),
    safetyConfirmed:
      input.safetyConfirmation?.manualActivationIntent === true &&
      input.safetyConfirmation.singleUserScopeConfirmed === true &&
      input.safetyConfirmation.localStorageFallbackConfirmed === true &&
      input.safetyConfirmation.noDefaultSyncConfirmed === true &&
      input.safetyConfirmation.noBackgroundWorkConfirmed === true &&
      input.safetyConfirmation.noSilentOverwriteConfirmed === true &&
      input.safetyConfirmation.noServiceRoleInBrowserConfirmed === true &&
      input.safetyConfirmation.noSaasScopeConfirmed === true &&
      input.safetyConfirmation.localBackupRequiredConfirmed === true &&
      input.safetyConfirmation.dryRunRequiredConfirmed === true,
    boundarySafe: hasOnlySafeBoundaryValues(blockers),
    requiresExplicitOptIn: true,
    requiresLocalBackupBeforeSync: true,
    requiresDryRunBeforeWrite: true,
    liveCloudSyncActivated: false,
    authRuntimeEnabled: false,
    syncRuntimeEnabled: false,
    productionLaunchPerformed: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    localStorageDeleted: false,
    localStorageFallbackPreserved: input.safetyConfirmation?.localStorageFallbackConfirmed === true,
    nextPhase: '20B - Supabase Project Env & Runtime Readiness Check V1',
    createdAt,
  };
};
