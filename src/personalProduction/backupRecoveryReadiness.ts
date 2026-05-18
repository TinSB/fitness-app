export type BackupRecoveryStatus =
  | 'ready'
  | 'backup_recommended'
  | 'backup_stale'
  | 'backup_missing'
  | 'backup_unverified'
  | 'restore_rehearsal_needed'
  | 'emergency_local_ready'
  | 'emergency_local_unavailable'
  | 'cloud_candidate_paused'
  | 'recovery_blocked'
  | 'source_of_truth_unclear'
  | 'owner_review_required'
  | 'schema_review_required'
  | 'local_first_safe_mode';

export type BackupRecoveryAction =
  | 'continue_localStorage_primary'
  | 'create_manual_backup'
  | 'verify_latest_backup'
  | 'rehearse_restore'
  | 'rehearse_emergency_local_restore'
  | 'pause_cloud_candidate'
  | 'do_not_cloud_pull'
  | 'do_not_cloud_push'
  | 'inspect_owner_scope'
  | 'inspect_schema_validation'
  | 'use_emergency_local_mode'
  | 'record_incident_note'
  | 'escalate_to_task16d'
  | 'no_action_needed';

export type BackupRecoverySeverity = 'ready' | 'info' | 'caution' | 'stop' | 'emergency';

export type BackupRecoveryMode =
  | 'localStorage-primary'
  | 'local-first-safe-mode'
  | 'cloud-candidate'
  | 'fallback-localStorage'
  | 'emergency-local'
  | 'unknown';

export type BackupRecoveryReadinessInput = {
  currentMode?: BackupRecoveryMode;
  lastBackupAt?: string | number | Date | null;
  lastSuccessfulRestoreRehearsalAt?: string | number | Date | null;
  lastWorkoutLoggedAt?: string | number | Date | null;
  backupVerified?: boolean;
  emergencyLocalAvailable?: boolean;
  rollbackAvailable?: boolean;
  ownerScopeClear?: boolean;
  schemaValidationClear?: boolean;
  cloudCandidateEnabled?: boolean;
  unresolvedConflict?: boolean;
  sourceOfTruthClear?: boolean;
};

export type BackupRecoveryReadinessResult = {
  status: BackupRecoveryStatus;
  severity: BackupRecoverySeverity;
  recommendedActions: BackupRecoveryAction[];
  checklist: BackupRecoveryAction[];
  canContinueLocal: boolean;
  shouldPauseCloudCandidate: boolean;
  shouldUseEmergencyLocal: boolean;
  localDataMustRemainUnchanged: true;
  cloudDataMustRemainUnchanged: true;
  sourceOfTruthChanged: false;
  reason: string;
};

type StatusProfile = Pick<
  BackupRecoveryReadinessResult,
  'status' | 'severity' | 'recommendedActions' | 'canContinueLocal' | 'shouldPauseCloudCandidate' | 'shouldUseEmergencyLocal' | 'reason'
>;

const uniqueActions = (actions: BackupRecoveryAction[]): BackupRecoveryAction[] => [...new Set(actions)];

const toTime = (value: BackupRecoveryReadinessInput['lastBackupAt']): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const backupOlderThanWorkout = (input: BackupRecoveryReadinessInput) => {
  const backupTime = toTime(input.lastBackupAt);
  const workoutTime = toTime(input.lastWorkoutLoggedAt);
  return backupTime !== null && workoutTime !== null && backupTime < workoutTime;
};

const withCloudCandidateGuard = (
  actions: BackupRecoveryAction[],
  shouldPauseCloudCandidate: boolean,
): BackupRecoveryAction[] => {
  if (!shouldPauseCloudCandidate) return uniqueActions(actions);
  return uniqueActions([...actions, 'pause_cloud_candidate', 'do_not_cloud_pull', 'do_not_cloud_push']);
};

const result = (profile: StatusProfile): BackupRecoveryReadinessResult => {
  const recommendedActions = withCloudCandidateGuard(profile.recommendedActions, profile.shouldPauseCloudCandidate);
  const checklist = uniqueActions([
    ...recommendedActions,
    ...(profile.shouldUseEmergencyLocal ? ['rehearse_emergency_local_restore'] as BackupRecoveryAction[] : []),
    'record_incident_note',
  ]);

  return {
    ...profile,
    recommendedActions,
    checklist,
    localDataMustRemainUnchanged: true,
    cloudDataMustRemainUnchanged: true,
    sourceOfTruthChanged: false,
  };
};

export const evaluateBackupRecoveryReadiness = (
  input: BackupRecoveryReadinessInput = {},
): BackupRecoveryReadinessResult => {
  if (input.sourceOfTruthClear === false || input.currentMode === 'unknown') {
    return result({
      status: 'source_of_truth_unclear',
      severity: 'emergency',
      recommendedActions: ['pause_cloud_candidate', 'use_emergency_local_mode', 'continue_localStorage_primary'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: true,
      reason: 'Source-of-truth is unclear; stop candidate operations and return to local-first recovery.',
    });
  }

  if (input.emergencyLocalAvailable === false) {
    return result({
      status: 'emergency_local_unavailable',
      severity: 'emergency',
      recommendedActions: ['pause_cloud_candidate', 'record_incident_note', 'escalate_to_task16d'],
      canContinueLocal: false,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'Emergency local mode is not confirmed, so cloud candidate work must stop.',
    });
  }

  if (input.unresolvedConflict === true) {
    return result({
      status: 'recovery_blocked',
      severity: 'stop',
      recommendedActions: ['pause_cloud_candidate', 'record_incident_note'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'An unresolved conflict blocks safe backup or candidate decisions.',
    });
  }

  if (input.ownerScopeClear === false) {
    return result({
      status: 'owner_review_required',
      severity: 'stop',
      recommendedActions: ['inspect_owner_scope', 'pause_cloud_candidate'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'Owner scope is unclear and must be reviewed before candidate operations.',
    });
  }

  if (input.schemaValidationClear === false) {
    return result({
      status: 'schema_review_required',
      severity: 'stop',
      recommendedActions: ['inspect_schema_validation', 'pause_cloud_candidate'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'Schema validation is unclear and must be reviewed before candidate operations.',
    });
  }

  if (toTime(input.lastBackupAt) === null) {
    return result({
      status: 'backup_missing',
      severity: 'stop',
      recommendedActions: ['create_manual_backup', 'pause_cloud_candidate'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'No confirmable backup exists.',
    });
  }

  if (backupOlderThanWorkout(input)) {
    return result({
      status: 'backup_stale',
      severity: 'caution',
      recommendedActions: ['verify_latest_backup', 'create_manual_backup'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: input.cloudCandidateEnabled === true,
      shouldUseEmergencyLocal: false,
      reason: 'Backup is older than the latest logged workout.',
    });
  }

  if (input.backupVerified !== true) {
    return result({
      status: 'backup_unverified',
      severity: 'caution',
      recommendedActions: ['verify_latest_backup', 'rehearse_restore'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: input.cloudCandidateEnabled === true,
      shouldUseEmergencyLocal: false,
      reason: 'Backup exists but has not been verified.',
    });
  }

  if (toTime(input.lastSuccessfulRestoreRehearsalAt) === null) {
    return result({
      status: 'restore_rehearsal_needed',
      severity: 'caution',
      recommendedActions: ['rehearse_restore'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: input.cloudCandidateEnabled === true,
      shouldUseEmergencyLocal: false,
      reason: 'Restore rehearsal has not been completed.',
    });
  }

  if (input.currentMode === 'emergency-local') {
    return result({
      status: 'emergency_local_ready',
      severity: 'info',
      recommendedActions: ['continue_localStorage_primary', 'rehearse_emergency_local_restore'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: input.cloudCandidateEnabled === true,
      shouldUseEmergencyLocal: true,
      reason: 'Emergency local mode is available for personal recovery.',
    });
  }

  if (input.cloudCandidateEnabled === true) {
    return result({
      status: 'cloud_candidate_paused',
      severity: 'caution',
      recommendedActions: ['pause_cloud_candidate', 'continue_localStorage_primary'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      reason: 'Cloud candidate should stay paused until backup and recovery checks are manually accepted.',
    });
  }

  if (input.currentMode === 'local-first-safe-mode' || input.currentMode === 'fallback-localStorage') {
    return result({
      status: 'local_first_safe_mode',
      severity: 'ready',
      recommendedActions: ['continue_localStorage_primary', 'no_action_needed'],
      canContinueLocal: true,
      shouldPauseCloudCandidate: false,
      shouldUseEmergencyLocal: false,
      reason: 'Local-first safe mode is ready for personal use.',
    });
  }

  return result({
    status: 'ready',
    severity: 'ready',
    recommendedActions: ['continue_localStorage_primary', 'no_action_needed'],
    canContinueLocal: true,
    shouldPauseCloudCandidate: false,
    shouldUseEmergencyLocal: false,
    reason: 'Backup and recovery readiness checks are satisfied for local-first personal use.',
  });
};

export const recommendBackupRecoveryAction = (
  input: BackupRecoveryReadinessInput = {},
): BackupRecoveryAction => evaluateBackupRecoveryReadiness(input).recommendedActions[0] ?? 'no_action_needed';

export const buildBackupRecoveryChecklist = (
  input: BackupRecoveryReadinessInput = {},
): BackupRecoveryAction[] => evaluateBackupRecoveryReadiness(input).checklist;
