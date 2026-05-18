import { describe, expect, it } from 'vitest';
import {
  buildRecoveryChecklist,
  classifyPersonalProductionIncident,
  recommendRecoveryAction,
  type PersonalProductionIncidentCategory,
} from '../src/cloudProduction/realWorldFailureRecoveryHardening';
import { readSource } from './runtimeBoundaryTestHelpers';

const requiredCategories: PersonalProductionIncidentCategory[] = [
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
];

describe('real-world failure recovery hardening helper', () => {
  it('classifies all required personal production incident categories', () => {
    for (const incidentCategory of requiredCategories) {
      expect(classifyPersonalProductionIncident({ incidentCategory })).toBe(incidentCategory);
    }
  });

  it('defaults unknown incidents to local-first review without source-of-truth mutation', () => {
    expect(recommendRecoveryAction({ incidentCategory: 'not_registered' })).toMatchObject({
      incidentCategory: 'unknown',
      severity: 'caution',
      recommendedAction: 'continue_localStorage_primary',
      shouldPauseCloudCandidate: false,
      shouldForceEmergencyLocal: false,
      localDataMustRemainUnchanged: true,
      cloudDataMustRemainUnchanged: true,
      sourceOfTruthChanged: false,
      requiresManualReview: true,
      escalationTarget: 'none',
    });
  });

  it('keeps low-risk observations local-first and non-mutating', () => {
    expect(recommendRecoveryAction({ incidentCategory: 'low_risk_observation' })).toMatchObject({
      severity: 'info',
      recommendedAction: 'continue_localStorage_primary',
      sourceOfTruthChanged: false,
      requiresManualReview: false,
    });
  });

  it('recommends local-first cloud pause for repeated fallback', () => {
    const result = recommendRecoveryAction({ incidentCategory: 'repeated_fallback' });

    expect(result).toMatchObject({
      severity: 'caution',
      recommendedAction: 'pause_cloud_candidate',
      shouldPauseCloudCandidate: true,
      sourceOfTruthChanged: false,
    });
    expect(result.checklist).toContain('continue_localStorage_primary');
    expect(result.checklist).toContain('run_rollback_rehearsal');
  });

  it('routes owner mismatch to owner-scope inspection with cloud candidate paused', () => {
    const result = recommendRecoveryAction({ incidentCategory: 'owner_mismatch' });

    expect(result).toMatchObject({
      severity: 'stop',
      recommendedAction: 'pause_cloud_candidate',
      shouldPauseCloudCandidate: true,
      localDataMustRemainUnchanged: true,
      cloudDataMustRemainUnchanged: true,
      sourceOfTruthChanged: false,
      escalationTarget: 'manual_owner_review',
    });
    expect(result.checklist).toContain('inspect_owner_scope');
  });

  it('routes schema validation failure to schema inspection with cloud candidate paused', () => {
    const result = recommendRecoveryAction({ incidentCategory: 'schema_validation_failed' });

    expect(result).toMatchObject({
      severity: 'stop',
      recommendedAction: 'pause_cloud_candidate',
      shouldPauseCloudCandidate: true,
      sourceOfTruthChanged: false,
      escalationTarget: 'manual_schema_review',
    });
    expect(result.checklist).toContain('inspect_schema_validation');
  });

  it('blocks unsafe cloud pull and push scenarios', () => {
    expect(recommendRecoveryAction({ incidentCategory: 'cloud_pull_wants_auto_apply' })).toMatchObject({
      severity: 'emergency',
      recommendedAction: 'do_not_apply_cloud_pull',
      shouldPauseCloudCandidate: true,
      shouldForceEmergencyLocal: true,
      sourceOfTruthChanged: false,
    });

    for (const incidentCategory of ['cloud_push_missing_confirmation', 'cloud_push_fake_success_risk'] as const) {
      expect(recommendRecoveryAction({ incidentCategory })).toMatchObject({
        severity: 'emergency',
        recommendedAction: 'do_not_run_cloud_push',
        shouldPauseCloudCandidate: true,
        shouldForceEmergencyLocal: true,
        sourceOfTruthChanged: false,
      });
    }
  });

  it('uses emergency stop behavior for service role and sync detection risks', () => {
    for (const incidentCategory of [
      'service_role_browser_risk',
      'default_sync_detected',
      'background_sync_detected',
    ] as const) {
      expect(recommendRecoveryAction({ incidentCategory })).toMatchObject({
        severity: 'emergency',
        recommendedAction: 'force_emergency_local_mode',
        shouldPauseCloudCandidate: true,
        shouldForceEmergencyLocal: true,
        sourceOfTruthChanged: false,
        escalationTarget: 'emergency_local_only',
      });
    }
  });

  it('forces emergency local mode when rollback failed', () => {
    expect(recommendRecoveryAction({ incidentCategory: 'rollback_failed' })).toMatchObject({
      severity: 'emergency',
      recommendedAction: 'force_emergency_local_mode',
      shouldPauseCloudCandidate: true,
      shouldForceEmergencyLocal: true,
      localDataMustRemainUnchanged: true,
      cloudDataMustRemainUnchanged: true,
      sourceOfTruthChanged: false,
    });
  });

  it('escalates insufficient diagnostics to Task 15C cleanup', () => {
    expect(recommendRecoveryAction({ incidentCategory: 'diagnostics_insufficient' })).toMatchObject({
      severity: 'caution',
      recommendedAction: 'inspect_diagnostics_snapshot',
      sourceOfTruthChanged: false,
      escalationTarget: 'task15c_ux_cleanup',
    });
  });

  it('returns checklist actions without performing recovery', () => {
    expect(buildRecoveryChecklist({ incidentCategory: 'cloud_pull_confusing' })).toEqual([
      'pause_cloud_candidate',
      'keep_local_data_unchanged',
      'disable_cloud_pull',
      'disable_cloud_push',
      'disable_supabase_adapter_candidate',
      'disable_backend_primary_candidate',
      'do_not_apply_cloud_pull',
      'inspect_diagnostics_snapshot',
    ]);
  });

  it('keeps every required category non-mutating', () => {
    for (const incidentCategory of requiredCategories) {
      expect(recommendRecoveryAction({ incidentCategory })).toMatchObject({
        localDataMustRemainUnchanged: true,
        cloudDataMustRemainUnchanged: true,
        sourceOfTruthChanged: false,
      });
    }
  });

  it('does not use storage network env or provider side effects', () => {
    const source = readSource('src/cloudProduction/realWorldFailureRecoveryHardening.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'process.env',
      'import.meta.env',
      'localStorage.',
      'sessionStorage.',
      'createClient',
      'supabase.',
      'POST /data-health/repair/apply',
      'POST /reset',
      'POST /recovery',
      'POST /backup',
      'POST /export',
      'POST /import',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'backgroundWorker',
      'automaticUpload',
      'automaticDownload',
      'polling',
      'timer',
      'automaticWorker',
      'telemetryUpload',
      'analyticsUpload',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
