import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSupabaseClientAdapterCandidate } from '../src/cloudProduction/supabaseClientAdapterCandidate';
import { runCloudPullCandidate } from '../src/cloudProduction/cloudPullCandidate';
import { CLOUD_PUSH_STATUS_FIELD, runCloudPushCandidate } from '../src/cloudProduction/cloudPushCandidate';
import { detectCloudSyncConflict } from '../src/cloudProduction/cloudSyncConflictDetection';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud database sync regression lock', () => {
  it('keeps cloud candidates disabled or manually gated by default', () => {
    expect(createSupabaseClientAdapterCandidate()).toMatchObject({
      enabled: false,
      status: 'disabled',
      sourceOfTruthChanged: false,
    });

    expect(runCloudPullCandidate()).toMatchObject({
      status: 'disabled',
      applied: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
    });

    const push = runCloudPushCandidate();
    expect(push).toMatchObject({
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
    expect(push[CLOUD_PUSH_STATUS_FIELD]).toBe('disabled');

    expect(detectCloudSyncConflict()).toMatchObject({
      manualResolutionRequired: true,
      canAutoApply: false,
    });
  });

  it('keeps package dependency drift limited to the authorized Supabase client', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual([
      '@supabase/supabase-js',
      'ajv',
      'lucide-react',
      'react',
      'react-dom',
    ]);
    expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    expect(Object.keys(packageJson.scripts).filter((script) => /supabase|cloud/i.test(script))).toEqual([]);
  });

  it('keeps runtime source free of default sync, direct cloud routes, and background work tokens', () => {
    for (const path of [
      'src/cloudProduction/supabaseClientAdapterCandidate.ts',
      'src/cloudProduction/cloudAppDataRepositoryCandidate.ts',
      'src/cloudProduction/localToCloudMigrationDryRun.ts',
      'src/cloudProduction/cloudPullCandidate.ts',
      'src/cloudProduction/cloudPushCandidate.ts',
      'src/cloudProduction/cloudSyncConflictDetection.ts',
      'src/cloudProduction/manualConflictResolutionCandidate.ts',
      'src/cloudProduction/cloudOperationJournal.ts',
      'src/cloudProduction/cloudFallbackRollbackEmergencyLocalMode.ts',
    ]) {
      const source = readSource(path);
      for (const forbidden of [
        '/auth',
        '/account',
        '/sync',
        '/cloud',
        'localStorage.setItem',
        'localStorage.removeItem',
        'fetch(',
        'backgroundSync',
        'serviceWorker',
        'syncQueue',
        'backgroundWorker',
        'automaticUpload',
        'automaticDownload',
        'polling',
        'interval',
        'timer',
        'automaticWorker',
        'cloudWrite',
      ]) {
        expect(source, `${path} should not include ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('keeps unapproved schema and migration surfaces absent', () => {
    expect(existsSync('supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql')).toBe(true);
    for (const path of [
      'database/migrations',
      'src/cloudProduction/normalizedTrainingTables.ts',
      'src/cloudProduction/sqlMigrations.ts',
    ]) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it('documents the regression lock', () => {
    const doc = readSource('docs/CLOUD_DATABASE_SYNC_REGRESSION_LOCK.md');

    for (const expected of [
      'Cloud Database / Sync Regression Lock V1',
      'Supabase client adapter is disabled by default.',
      'Cloud pull does not overwrite local by default.',
      'Cloud push requires manual confirmation.',
      'Conflict resolution is manual.',
      'No service role in browser.',
      '`@supabase/supabase-js` is the only authorized dependency drift.',
      'Cloud sync is not default.',
      'No background sync.',
      'No normalized training tables.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
