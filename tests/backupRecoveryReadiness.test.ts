import { describe, expect, it } from 'vitest';
import {
  buildBackupRecoveryChecklist,
  evaluateBackupRecoveryReadiness,
  recommendBackupRecoveryAction,
  type BackupRecoveryReadinessInput,
} from '../src/personalProduction/backupRecoveryReadiness';
import { readSource } from './runtimeBoundaryTestHelpers';

const safeInput: BackupRecoveryReadinessInput = {
  currentMode: 'localStorage-primary',
  lastBackupAt: '2026-05-18T12:00:00.000Z',
  lastSuccessfulRestoreRehearsalAt: '2026-05-18T12:05:00.000Z',
  lastWorkoutLoggedAt: '2026-05-18T11:00:00.000Z',
  backupVerified: true,
  emergencyLocalAvailable: true,
  rollbackAvailable: true,
  ownerScopeClear: true,
  schemaValidationClear: true,
  cloudCandidateEnabled: false,
  unresolvedConflict: false,
  sourceOfTruthClear: true,
};

const dangerousStatuses = [
  { status: 'backup_missing', input: { ...safeInput, lastBackupAt: null } },
  { status: 'emergency_local_unavailable', input: { ...safeInput, emergencyLocalAvailable: false } },
  { status: 'source_of_truth_unclear', input: { ...safeInput, sourceOfTruthClear: false } },
  { status: 'owner_review_required', input: { ...safeInput, ownerScopeClear: false } },
  { status: 'schema_review_required', input: { ...safeInput, schemaValidationClear: false } },
  { status: 'recovery_blocked', input: { ...safeInput, unresolvedConflict: true } },
] as const;

describe('backup recovery readiness helper', () => {
  it('allows ready localStorage-primary use without changing source of truth', () => {
    const result = evaluateBackupRecoveryReadiness(safeInput);

    expect(result.status).toBe('ready');
    expect(result.severity).toBe('ready');
    expect(result.recommendedActions).toEqual(['continue_localStorage_primary', 'no_action_needed']);
    expect(result.canContinueLocal).toBe(true);
    expect(result.shouldPauseCloudCandidate).toBe(false);
    expect(result.sourceOfTruthChanged).toBe(false);
  });

  it('returns primary recommendation and checklist from the same pure evaluation', () => {
    expect(recommendBackupRecoveryAction({ ...safeInput, lastBackupAt: null })).toBe('create_manual_backup');
    expect(buildBackupRecoveryChecklist({ ...safeInput, lastBackupAt: null })).toEqual(
      expect.arrayContaining(['create_manual_backup', 'pause_cloud_candidate', 'record_incident_note']),
    );
  });

  it('recommends manual backup and pauses cloud candidate when backup is missing', () => {
    const result = evaluateBackupRecoveryReadiness({ ...safeInput, lastBackupAt: null });

    expect(result.status).toBe('backup_missing');
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining(['create_manual_backup', 'pause_cloud_candidate', 'do_not_cloud_pull', 'do_not_cloud_push']),
    );
    expect(result.shouldPauseCloudCandidate).toBe(true);
  });

  it('recommends verification or manual backup when backup is stale', () => {
    const result = evaluateBackupRecoveryReadiness({
      ...safeInput,
      cloudCandidateEnabled: true,
      lastBackupAt: '2026-05-17T12:00:00.000Z',
      lastWorkoutLoggedAt: '2026-05-18T11:00:00.000Z',
    });

    expect(result.status).toBe('backup_stale');
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining(['verify_latest_backup', 'create_manual_backup', 'pause_cloud_candidate']),
    );
  });

  it('recommends restore rehearsal when backup is unverified', () => {
    const result = evaluateBackupRecoveryReadiness({ ...safeInput, cloudCandidateEnabled: true, backupVerified: false });

    expect(result.status).toBe('backup_unverified');
    expect(result.recommendedActions).toEqual(expect.arrayContaining(['verify_latest_backup', 'rehearse_restore']));
    expect(result.shouldPauseCloudCandidate).toBe(true);
  });

  it('recommends restore rehearsal when no restore rehearsal exists', () => {
    const result = evaluateBackupRecoveryReadiness({
      ...safeInput,
      cloudCandidateEnabled: true,
      lastSuccessfulRestoreRehearsalAt: null,
    });

    expect(result.status).toBe('restore_rehearsal_needed');
    expect(result.recommendedActions).toEqual(expect.arrayContaining(['rehearse_restore', 'pause_cloud_candidate']));
  });

  it('uses stop or emergency review for emergency local unavailable', () => {
    const result = evaluateBackupRecoveryReadiness({ ...safeInput, emergencyLocalAvailable: false });

    expect(result.status).toBe('emergency_local_unavailable');
    expect(result.severity).toBe('emergency');
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining(['pause_cloud_candidate', 'record_incident_note', 'escalate_to_task16d']),
    );
  });

  it('routes unclear source of truth to cloud pause and emergency local-first action', () => {
    const result = evaluateBackupRecoveryReadiness({ ...safeInput, sourceOfTruthClear: false });

    expect(result.status).toBe('source_of_truth_unclear');
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining(['pause_cloud_candidate', 'use_emergency_local_mode', 'continue_localStorage_primary']),
    );
    expect(result.shouldUseEmergencyLocal).toBe(true);
  });

  it('requires owner and schema review before cloud candidate operations', () => {
    const ownerResult = evaluateBackupRecoveryReadiness({ ...safeInput, ownerScopeClear: false });
    const schemaResult = evaluateBackupRecoveryReadiness({ ...safeInput, schemaValidationClear: false });

    expect(ownerResult.status).toBe('owner_review_required');
    expect(ownerResult.recommendedActions).toEqual(expect.arrayContaining(['inspect_owner_scope', 'pause_cloud_candidate']));
    expect(schemaResult.status).toBe('schema_review_required');
    expect(schemaResult.recommendedActions).toEqual(
      expect.arrayContaining(['inspect_schema_validation', 'pause_cloud_candidate']),
    );
  });

  it('pauses cloud candidate for unresolved conflict and unsafe enabled cloud candidate', () => {
    const conflictResult = evaluateBackupRecoveryReadiness({ ...safeInput, unresolvedConflict: true });
    const cloudCandidateResult = evaluateBackupRecoveryReadiness({ ...safeInput, cloudCandidateEnabled: true });

    expect(conflictResult.status).toBe('recovery_blocked');
    expect(conflictResult.recommendedActions).toEqual(expect.arrayContaining(['pause_cloud_candidate']));
    expect(cloudCandidateResult.status).toBe('cloud_candidate_paused');
    expect(cloudCandidateResult.recommendedActions).toEqual(
      expect.arrayContaining(['pause_cloud_candidate', 'do_not_cloud_pull', 'do_not_cloud_push']),
    );
  });

  it.each(dangerousStatuses)('keeps data unchanged for dangerous state $status', ({ input }) => {
    const result = evaluateBackupRecoveryReadiness(input);

    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.localDataMustRemainUnchanged).toBe(true);
    expect(result.cloudDataMustRemainUnchanged).toBe(true);
  });

  it('does not include side-effectful storage network route or Supabase access', () => {
    const source = readSource('src/personalProduction/backupRecoveryReadiness.ts');

    for (const forbidden of [
      'window.localStorage',
      '.localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'node:',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'setItem(',
      'removeItem(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
