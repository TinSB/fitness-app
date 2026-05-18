import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('real-world failure recovery hardening documentation', () => {
  const doc = () => readSource('docs/REAL_WORLD_FAILURE_RECOVERY_HARDENING.md');

  it('records Task 15B identity and Task 15A baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 15B',
      'Real-World Failure / Recovery Hardening',
      'Task 15A complete',
      'PR #252',
      '975d6ee80fe7e6cea115d5af4ab8f674372fc639',
      '1049 files / 4193 tests',
      'dist token scan clean',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves safety baseline boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage default/fallback/migration/emergency',
      'backend/cloud candidate explicit opt-in and reversible',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'conflict resolution remains manual',
      'rollback / kill switch',
      'emergency local mode',
      'api-primary-dev dev/local only and not production-ready',
      'accepted browser mutation routes exactly seven',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals and blocked release behavior', () => {
    const content = doc();

    for (const expected of [
      'change runtime behavior',
      'enable default cloud sync',
      'enable background sync',
      'enable automatic multi-device sync',
      'connect to Supabase',
      'upload training data',
      'apply cloud pull',
      'perform cloud push',
      'deploy production runtime',
      'add external monitoring upload',
      'add SaaS/multi-user runtime',
      'add normalized training tables',
      'perform destructive migration',
      'use real personal training data in tests',
      'add package/dependency/script/lockfile changes',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('contains the failure classification table recovery decision tree and incident log template', () => {
    const content = doc();

    for (const expected of [
      '## Failure Classification Table',
      '| Failure category | Severity | Immediate action | User-visible meaning | Pause cloud candidate? | Force emergency local mode? | Escalate into Task 15C? |',
      '## Recovery Decision Tree',
      'If source-of-truth is unclear, stop and use localStorage-primary / emergency local.',
      'If cloud pull wants to auto-apply, stop and do not apply.',
      'If cloud push skips confirmation, stop and do not push.',
      'If owner mismatch occurs, stop cloud operations and inspect owner scope.',
      'If schema validation fails, stop cloud operations and inspect schema validation.',
      'If rollback unavailable, force emergency local mode.',
      'If diagnostics insufficient, record incident and escalate to Task 15C.',
      'If service role appears in browser, stop immediately and treat as emergency.',
      '## Incident Log Template',
      '| Date | Incident category | Severity | Runtime source | Cloud pull attempted? | Cloud push attempted? | Owner mismatch? | Schema validation failure? | Rollback used? | Emergency local mode used? | Local data preserved? | Cloud data unchanged? | Recommended action | Follow-up task |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('lists every required failure category and recovery action', () => {
    const content = doc();

    for (const expected of [
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
      'continue_localStorage_primary',
      'pause_cloud_candidate',
      'disable_cloud_pull',
      'disable_cloud_push',
      'disable_supabase_adapter_candidate',
      'disable_backend_primary_candidate',
      'force_emergency_local_mode',
      'run_rollback_rehearsal',
      'run_emergency_restore_rehearsal',
      'inspect_owner_scope',
      'inspect_schema_validation',
      'inspect_diagnostics_snapshot',
      'keep_local_data_unchanged',
      'do_not_apply_cloud_pull',
      'do_not_run_cloud_push',
      'stop_and_escalate_to_task_15c',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('contains required recovery checklists and Task 15C recommendation without starting it', () => {
    const content = doc();

    for (const expected of [
      '### Repeated Fallback',
      '### Rollback Needed',
      '### Emergency Local Mode Used',
      '### Owner Mismatch',
      '### Schema Validation Failure',
      '### Confusing Cloud Pull Rehearsal',
      '### Confusing Cloud Push Rehearsal',
      '### Diagnostics Insufficient',
      'Recommended next task: Task 15C - UX Cleanup for Production Candidate Controls.',
      'Task 15B does not start Task 15C.',
      'Task 15B supports personal production candidate stabilization only.',
      'Task 15B does not authorize public SaaS launch.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
  });
});
