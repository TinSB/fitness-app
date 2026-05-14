import { describe, expect, it } from 'vitest';
import {
  resolveCloudFallbackRollbackEmergencyLocalMode,
  type CloudFallbackReason,
} from '../src/cloudProduction/cloudFallbackRollbackEmergencyLocalMode';
import { readSource } from './runtimeBoundaryTestHelpers';

const reasons: CloudFallbackReason[] = [
  'cloud_unavailable',
  'push_failed',
  'pull_failed',
  'conflict_unresolved',
  'owner_mismatch',
  'invalid_cloud_data',
  'auth_session_invalid',
  'manual_abort',
  'rollback_to_local',
  'emergency_local_mode',
];

describe('cloud fallback rollback emergency local mode', () => {
  it.each(reasons)('keeps local app and emergency mode available for %s', (reason) => {
    expect(resolveCloudFallbackRollbackEmergencyLocalMode({ reason })).toMatchObject({
      localAppAvailable: true,
      fallbackLocalStorageAvailable: true,
      emergencyLocalAvailable: true,
      cloudCandidateDisabled: true,
      localDataDeleted: false,
      sourceOfTruthChanged: false,
      reason,
    });
  });

  it('performs rollback only when requested and available', () => {
    expect(resolveCloudFallbackRollbackEmergencyLocalMode({
      reason: 'rollback_to_local',
      rollbackRequested: true,
      rollbackSnapshotAvailable: true,
    })).toMatchObject({
      rollbackAvailable: true,
      rollbackPerformed: true,
      localDataDeleted: false,
    });

    expect(resolveCloudFallbackRollbackEmergencyLocalMode({
      reason: 'rollback_to_local',
      localStorageAvailable: false,
      rollbackRequested: true,
      rollbackSnapshotAvailable: false,
    })).toMatchObject({
      rollbackAvailable: false,
      rollbackPerformed: false,
      emergencyLocalAvailable: true,
    });
  });

  it('keeps emergency local mode available even if fallback localStorage is unavailable', () => {
    expect(resolveCloudFallbackRollbackEmergencyLocalMode({
      reason: 'emergency_local_mode',
      localStorageAvailable: false,
      emergencyBackupAvailable: true,
    })).toMatchObject({
      localAppAvailable: true,
      fallbackLocalStorageAvailable: false,
      emergencyLocalAvailable: true,
      cloudCandidateDisabled: true,
    });
  });

  it('documents fallback rollback boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_FALLBACK_ROLLBACK_EMERGENCY_LOCAL_MODE.md');

    for (const expected of [
      'Task 12.15 Cloud Fallback / Rollback / Emergency Local Mode V1',
      'localStorage fallback remains available',
      'emergency backup remains available',
      'backend-primary candidate can be disabled',
      'cloud candidate failure does not break local app',
      'No reset/recovery HTTP routes.',
      'No backup/import/export HTTP routes.',
      'Recommended next task: Task 12.16 Cloud Database / Sync Manual Acceptance V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of route and automatic work behavior', () => {
    const source = readSource('src/cloudProduction/cloudFallbackRollbackEmergencyLocalMode.ts');

    for (const forbidden of [
      '/auth',
      '/account',
      '/sync',
      '/cloud',
      '/reset/',
      '/recovery/',
      '/backup/import',
      '/backup/export',
      'localStorage.removeItem',
      'localStorage.setItem',
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
      'node:http',
      'node:sqlite',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
