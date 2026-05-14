import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { createSupabaseClientAdapterCandidate } from '../src/cloudProduction/supabaseClientAdapterCandidate';
import { runCloudPullCandidate } from '../src/cloudProduction/cloudPullCandidate';
import { CLOUD_PUSH_STATUS_FIELD, runCloudPushCandidate } from '../src/cloudProduction/cloudPushCandidate';
import { runManualConflictResolutionCandidate } from '../src/cloudProduction/manualConflictResolutionCandidate';
import { createReleaseRollbackKillSwitchResult } from '../src/cloudProduction/releaseRollbackKillSwitch';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production release regression lock', () => {
  it('keeps localStorage default fallback migration emergency as the runtime baseline', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({ DEV: false })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('keeps Supabase client disabled unless explicitly configured', () => {
    const adapter = createSupabaseClientAdapterCandidate();

    expect(adapter).toMatchObject({
      status: 'disabled',
      enabled: false,
      clientCreated: false,
      serviceRoleExposed: false,
      sourceOfTruthChanged: false,
    });
    expect(adapter.readCandidate()).toMatchObject({
      ok: false,
      status: 'disabled',
      networkAttempted: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('keeps cloud pull from applying local changes by default', () => {
    expect(runCloudPullCandidate()).toMatchObject({
      ok: false,
      status: 'disabled',
      pullCandidate: null,
      applied: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
    });
  });

  it('keeps cloud push behind manual confirmation dry run owner and backup gates', () => {
    const result = runCloudPushCandidate({
      enabled: true,
      explicitOptIn: true,
    });

    expect(result).toMatchObject({
      ok: false,
      noFakeSuccess: true,
      localDataChanged: false,
      sourceOfTruthChanged: false,
      rollbackAvailable: false,
    });
    expect(result[CLOUD_PUSH_STATUS_FIELD]).toBe('manual_confirmation_missing');
  });

  it('keeps conflict resolution manual and non-mutating', () => {
    expect(runManualConflictResolutionCandidate({
      action: 'keep_cloud',
    })).toMatchObject({
      confirmed: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      aborted: true,
      reason: 'Manual confirmation is required.',
    });
  });

  it('keeps rollback kill switch non-destructive and reversible', () => {
    expect(createReleaseRollbackKillSwitchResult({ reason: 'manual_operator_request' })).toMatchObject({
      cloudPullDisabled: true,
      cloudPushDisabled: true,
      supabaseAdapterDisabled: true,
      backendPrimaryDisabled: true,
      futureExternalMonitoringDisabled: true,
      rollbackAvailable: true,
      localDataDeleted: false,
      cloudDataOverwritten: false,
      sourceOfTruthChanged: false,
    });
  });

  it('keeps only the previously authorized Supabase dependency and no new scripts', () => {
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

  it('documents the production release regression lock', () => {
    const doc = readSource('docs/PRODUCTION_RELEASE_REGRESSION_LOCK.md');

    for (const expected of [
      'Task 13.15 Production Release Regression Lock V1',
      'localStorage default/fallback/migration/emergency remains',
      'backend/cloud candidate remains explicit opt-in',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'conflict resolution remains manual',
      'Supabase client remains disabled unless explicitly configured',
      'no external monitoring upload',
      'no production deployment runtime auto-start',
      'accepted browser mutation routes remain exactly seven',
      '@supabase/supabase-js remains the only authorized dependency drift',
      'Recommended next task: Task 13.16 Phase 13 Completion Archive V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
