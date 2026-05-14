import { describe, expect, it } from 'vitest';
import {
  detectCloudSyncConflict,
  type CloudConflictType,
} from '../src/cloudProduction/cloudSyncConflictDetection';
import { readSource } from './runtimeBoundaryTestHelpers';

const cases: Array<[CloudConflictType, Parameters<typeof detectCloudSyncConflict>[0]]> = [
  ['local_newer', { localUpdatedAt: '2026-01-03', cloudUpdatedAt: '2026-01-02' }],
  ['cloud_newer', { localUpdatedAt: '2026-01-02', cloudUpdatedAt: '2026-01-03' }],
  ['both_changed', {
    localBaseHash: 'base-local',
    cloudBaseHash: 'base-cloud',
    localSnapshotHash: 'local-new',
    cloudSnapshotHash: 'cloud-new',
  }],
  ['owner_mismatch', { ownerMatches: false }],
  ['schema_mismatch', { schemaMatches: false }],
  ['cloud_missing', { cloudExists: false }],
  ['local_missing', { localExists: false }],
  ['backend_primary_mismatch', { backendPrimaryMatches: false }],
  ['session_account_mismatch', { sessionAccountMatches: false }],
  ['device_identity_mismatch', { deviceIdentityMatches: false }],
];

describe('cloud sync conflict detection', () => {
  it.each(cases)('detects %s and requires manual resolution', (conflictType, input) => {
    expect(detectCloudSyncConflict(input)).toMatchObject({
      conflictType,
      manualResolutionRequired: true,
      canAutoApply: false,
    });
  });

  it('does not provide last-write-wins or silent overwrite behavior', () => {
    const result = detectCloudSyncConflict({
      localUpdatedAt: '2026-01-02',
      cloudUpdatedAt: '2026-01-02',
    });

    expect(result).toMatchObject({
      conflictType: 'both_changed',
      severity: 'info',
      manualResolutionRequired: true,
      canAutoApply: false,
    });
    expect(result.recommendedAction).toContain('manual review');
  });

  it('documents conflict detection boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_SYNC_CONFLICT_DETECTION.md');

    for (const expected of [
      'Task 12.12 Cloud Sync Conflict Detection V1',
      'No last-write-wins default.',
      'No silent overwrite.',
      'No automatic merge.',
      'manualResolutionRequired',
      'canAutoApply: false',
      'Recommended next task: Task 12.13 Manual Conflict Resolution Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of route and background work behavior', () => {
    const source = readSource('src/cloudProduction/cloudSyncConflictDetection.ts');

    for (const forbidden of [
      '/auth',
      '/account',
      '/sync',
      '/cloud',
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
