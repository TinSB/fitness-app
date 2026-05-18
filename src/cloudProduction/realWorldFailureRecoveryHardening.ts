export type PersonalProductionIncidentCategory =
  | 'local_app_unavailable'
  | 'local_storage_unavailable'
  | 'local_history_missing'
  | 'repeated_fallback'
  | 'rollback_needed'
  | 'rollback_failed'
  | 'emergency_local_used'
  | 'emergency_local_unavailable'
  | 'owner_mismatch'
  | 'schema_validation_failed'
  | 'cloud_pull_confusing'
  | 'cloud_pull_wants_auto_apply'
  | 'cloud_push_confusing'
  | 'cloud_push_missing_confirmation'
  | 'cloud_push_fake_success_risk'
  | 'conflict_unresolved'
  | 'diagnostics_insufficient'
  | 'service_role_browser_risk'
  | 'default_sync_detected'
  | 'background_sync_detected'
  | 'route_boundary_drift'
  | 'package_or_lockfile_drift'
  | 'source_of_truth_unclear'
  | 'unknown'
  | 'low_risk_observation';

export type RecoverySeverity = 'info' | 'caution' | 'stop' | 'emergency';

export type RecoveryAction =
  | 'continue_localStorage_primary'
  | 'pause_cloud_candidate'
  | 'disable_cloud_pull'
  | 'disable_cloud_push'
  | 'disable_supabase_adapter_candidate'
  | 'disable_backend_primary_candidate'
  | 'force_emergency_local_mode'
  | 'run_rollback_rehearsal'
  | 'run_emergency_restore_rehearsal'
  | 'inspect_owner_scope'
  | 'inspect_schema_validation'
  | 'inspect_diagnostics_snapshot'
  | 'keep_local_data_unchanged'
  | 'do_not_apply_cloud_pull'
  | 'do_not_run_cloud_push'
  | 'stop_and_escalate_to_task_15c';

export type RecoveryEscalationTarget =
  | 'none'
  | 'task15c_ux_cleanup'
  | 'task15b_followup_required'
  | 'manual_owner_review'
  | 'manual_schema_review'
  | 'emergency_local_only';

export type PersonalProductionIncidentInput = {
  incidentCategory?: PersonalProductionIncidentCategory | string;
};

export type PersonalProductionRecoveryRecommendation = {
  incidentCategory: PersonalProductionIncidentCategory;
  severity: RecoverySeverity;
  recommendedAction: RecoveryAction;
  shouldPauseCloudCandidate: boolean;
  shouldForceEmergencyLocal: boolean;
  localDataMustRemainUnchanged: true;
  cloudDataMustRemainUnchanged: true;
  sourceOfTruthChanged: false;
  requiresManualReview: boolean;
  escalationTarget: RecoveryEscalationTarget;
  checklist: RecoveryAction[];
};

type RecoveryProfile = Omit<
  PersonalProductionRecoveryRecommendation,
  | 'incidentCategory'
  | 'localDataMustRemainUnchanged'
  | 'cloudDataMustRemainUnchanged'
  | 'sourceOfTruthChanged'
>;

const incidentCategories = new Set<PersonalProductionIncidentCategory>([
  'local_app_unavailable',
  'local_storage_unavailable',
  'local_history_missing',
  'repeated_fallback',
  'rollback_needed',
  'rollback_failed',
  'emergency_local_used',
  'emergency_local_unavailable',
  'owner_mismatch',
  'schema_validation_failed',
  'cloud_pull_confusing',
  'cloud_pull_wants_auto_apply',
  'cloud_push_confusing',
  'cloud_push_missing_confirmation',
  'cloud_push_fake_success_risk',
  'conflict_unresolved',
  'diagnostics_insufficient',
  'service_role_browser_risk',
  'default_sync_detected',
  'background_sync_detected',
  'route_boundary_drift',
  'package_or_lockfile_drift',
  'source_of_truth_unclear',
  'unknown',
  'low_risk_observation',
]);

const uniqueActions = (actions: RecoveryAction[]): RecoveryAction[] => [...new Set(actions)];

const profile = (
  severity: RecoverySeverity,
  recommendedAction: RecoveryAction,
  options: {
    shouldPauseCloudCandidate?: boolean;
    shouldForceEmergencyLocal?: boolean;
    requiresManualReview?: boolean;
    escalationTarget?: RecoveryEscalationTarget;
    checklist?: RecoveryAction[];
  } = {},
): RecoveryProfile => {
  const checklist = uniqueActions([
    recommendedAction,
    'keep_local_data_unchanged',
    ...(options.shouldPauseCloudCandidate === true ? [
      'disable_cloud_pull',
      'disable_cloud_push',
      'disable_supabase_adapter_candidate',
      'disable_backend_primary_candidate',
    ] as RecoveryAction[] : []),
    ...(options.shouldForceEmergencyLocal === true ? ['force_emergency_local_mode'] as RecoveryAction[] : []),
    ...(options.checklist ?? []),
  ]);

  return {
    severity,
    recommendedAction,
    shouldPauseCloudCandidate: options.shouldPauseCloudCandidate ?? false,
    shouldForceEmergencyLocal: options.shouldForceEmergencyLocal ?? false,
    requiresManualReview: options.requiresManualReview ?? true,
    escalationTarget: options.escalationTarget ?? 'none',
    checklist,
  };
};

const recoveryProfiles: Record<PersonalProductionIncidentCategory, RecoveryProfile> = {
  local_app_unavailable: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['run_emergency_restore_rehearsal', 'inspect_diagnostics_snapshot'],
  }),
  local_storage_unavailable: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['run_emergency_restore_rehearsal', 'inspect_diagnostics_snapshot'],
  }),
  local_history_missing: profile('stop', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15b_followup_required',
    checklist: ['inspect_diagnostics_snapshot'],
  }),
  repeated_fallback: profile('caution', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15b_followup_required',
    checklist: ['continue_localStorage_primary', 'run_rollback_rehearsal'],
  }),
  rollback_needed: profile('stop', 'run_rollback_rehearsal', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15b_followup_required',
  }),
  rollback_failed: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['run_emergency_restore_rehearsal', 'stop_and_escalate_to_task_15c'],
  }),
  emergency_local_used: profile('stop', 'run_emergency_restore_rehearsal', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
  }),
  emergency_local_unavailable: profile('emergency', 'stop_and_escalate_to_task_15c', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['inspect_diagnostics_snapshot'],
  }),
  owner_mismatch: profile('stop', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'manual_owner_review',
    checklist: ['inspect_owner_scope'],
  }),
  schema_validation_failed: profile('stop', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'manual_schema_review',
    checklist: ['inspect_schema_validation'],
  }),
  cloud_pull_confusing: profile('caution', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15c_ux_cleanup',
    checklist: ['do_not_apply_cloud_pull', 'inspect_diagnostics_snapshot'],
  }),
  cloud_pull_wants_auto_apply: profile('emergency', 'do_not_apply_cloud_pull', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
  }),
  cloud_push_confusing: profile('caution', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15c_ux_cleanup',
    checklist: ['do_not_run_cloud_push', 'inspect_diagnostics_snapshot'],
  }),
  cloud_push_missing_confirmation: profile('emergency', 'do_not_run_cloud_push', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
  }),
  cloud_push_fake_success_risk: profile('emergency', 'do_not_run_cloud_push', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
  }),
  conflict_unresolved: profile('stop', 'pause_cloud_candidate', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15b_followup_required',
    checklist: ['inspect_diagnostics_snapshot'],
  }),
  diagnostics_insufficient: profile('caution', 'inspect_diagnostics_snapshot', {
    escalationTarget: 'task15c_ux_cleanup',
    checklist: ['continue_localStorage_primary'],
  }),
  service_role_browser_risk: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['stop_and_escalate_to_task_15c'],
  }),
  default_sync_detected: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['stop_and_escalate_to_task_15c'],
  }),
  background_sync_detected: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['stop_and_escalate_to_task_15c'],
  }),
  route_boundary_drift: profile('emergency', 'stop_and_escalate_to_task_15c', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
  }),
  package_or_lockfile_drift: profile('stop', 'stop_and_escalate_to_task_15c', {
    shouldPauseCloudCandidate: true,
    escalationTarget: 'task15b_followup_required',
  }),
  source_of_truth_unclear: profile('emergency', 'force_emergency_local_mode', {
    shouldPauseCloudCandidate: true,
    shouldForceEmergencyLocal: true,
    escalationTarget: 'emergency_local_only',
    checklist: ['continue_localStorage_primary'],
  }),
  unknown: profile('caution', 'continue_localStorage_primary', {
    checklist: ['inspect_diagnostics_snapshot'],
  }),
  low_risk_observation: profile('info', 'continue_localStorage_primary', {
    requiresManualReview: false,
  }),
};

export const classifyPersonalProductionIncident = (
  input: PersonalProductionIncidentInput = {},
): PersonalProductionIncidentCategory => {
  const candidate = input.incidentCategory;
  if (typeof candidate === 'string' && incidentCategories.has(candidate as PersonalProductionIncidentCategory)) {
    return candidate as PersonalProductionIncidentCategory;
  }

  return 'unknown';
};

export const recommendRecoveryAction = (
  input: PersonalProductionIncidentInput = {},
): PersonalProductionRecoveryRecommendation => {
  const incidentCategory = classifyPersonalProductionIncident(input);
  const selectedProfile = recoveryProfiles[incidentCategory];

  return {
    incidentCategory,
    severity: selectedProfile.severity,
    recommendedAction: selectedProfile.recommendedAction,
    shouldPauseCloudCandidate: selectedProfile.shouldPauseCloudCandidate,
    shouldForceEmergencyLocal: selectedProfile.shouldForceEmergencyLocal,
    localDataMustRemainUnchanged: true,
    cloudDataMustRemainUnchanged: true,
    sourceOfTruthChanged: false,
    requiresManualReview: selectedProfile.requiresManualReview,
    escalationTarget: selectedProfile.escalationTarget,
    checklist: selectedProfile.checklist,
  };
};

export const buildRecoveryChecklist = (
  input: PersonalProductionIncidentInput = {},
): RecoveryAction[] => recommendRecoveryAction(input).checklist;
