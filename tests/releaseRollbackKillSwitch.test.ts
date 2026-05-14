import { describe, expect, it } from 'vitest';
import {
  createReleaseRollbackKillSwitchResult,
  forceEmergencyLocalReleaseMode,
} from '../src/cloudProduction/releaseRollbackKillSwitch';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('release rollback kill switch', () => {
  it('disables cloud and backend candidates without deleting or overwriting data', () => {
    expect(createReleaseRollbackKillSwitchResult({
      reason: 'cloud_candidate_failure',
    })).toEqual({
      cloudPullDisabled: true,
      cloudPushDisabled: true,
      supabaseAdapterDisabled: true,
      backendPrimaryDisabled: true,
      emergencyLocalModeForced: false,
      localStoragePrimaryRestored: true,
      futureExternalMonitoringDisabled: true,
      rollbackAvailable: true,
      localDataDeleted: false,
      cloudDataOverwritten: false,
      sourceOfTruthChanged: false,
      reason: 'cloud_candidate_failure',
    });
  });

  it('can force emergency-local mode and restore localStorage-primary', () => {
    expect(forceEmergencyLocalReleaseMode('owner_mismatch')).toMatchObject({
      cloudPullDisabled: true,
      cloudPushDisabled: true,
      supabaseAdapterDisabled: true,
      backendPrimaryDisabled: true,
      emergencyLocalModeForced: true,
      localStoragePrimaryRestored: true,
      localDataDeleted: false,
      cloudDataOverwritten: false,
      sourceOfTruthChanged: false,
      reason: 'owner_mismatch',
    });
  });

  it('keeps rollback reversible even when localStorage restore is not requested', () => {
    expect(createReleaseRollbackKillSwitchResult({
      reason: 'unsafe_deployment_config',
      rollbackToLocalStoragePrimary: false,
    })).toMatchObject({
      rollbackAvailable: true,
      localStoragePrimaryRestored: false,
      localDataDeleted: false,
      cloudDataOverwritten: false,
      sourceOfTruthChanged: false,
    });
  });

  it('does not add destructive routes network calls or external transport hooks', () => {
    const source = readSource('src/cloudProduction/releaseRollbackKillSwitch.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'process.env',
      'localStorage.removeItem',
      'localStorage.clear',
      'POST /reset',
      'POST /recovery',
      'POST /backup',
      'POST /export',
      'POST /import',
      'telemetryUpload',
      'analyticsUpload',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents rollback and kill switch boundaries and next task', () => {
    const doc = readSource('docs/RELEASE_ROLLBACK_KILL_SWITCH.md');

    for (const expected of [
      'Task 13.12 Release Rollback / Kill Switch V1',
      'disable cloud pull',
      'disable cloud push',
      'disable Supabase adapter',
      'disable backend-primary candidate',
      'force emergency-local mode',
      'return to localStorage-primary',
      'does not delete local data',
      'does not auto-overwrite cloud data',
      'No reset/recovery HTTP route.',
      'No backup/import/export HTTP route.',
      'Recommended next task: Task 13.13 Privacy, Export & Delete Readiness V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
