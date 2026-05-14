import { describe, expect, it } from 'vitest';
import {
  runManualConflictResolutionCandidate,
  type ManualConflictResolutionAction,
} from '../src/cloudProduction/manualConflictResolutionCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

const validInput = (action: ManualConflictResolutionAction) => ({
  action,
  confirmed: true,
  backupAvailable: true,
  backupCreated: true,
  ownerValidated: true,
  schemaValidated: true,
});

describe('manual conflict resolution candidate', () => {
  it('supports only the allowed manual resolution actions', () => {
    const actions: ManualConflictResolutionAction[] = [
      'keep_local',
      'keep_cloud',
      'create_backup_then_replace_local',
      'create_cloud_snapshot_from_local',
      'abort',
    ];

    for (const action of actions) {
      const result = runManualConflictResolutionCandidate(validInput(action));
      expect(result.action).toBe(action);
      expect(result.localDataChanged).toBe(false);
      expect(result.cloudDataChanged).toBe(false);
      expect(result.sourceOfTruthChanged).toBe(false);
    }
  });

  it('aborts by default and requires manual confirmation', () => {
    expect(runManualConflictResolutionCandidate()).toMatchObject({
      action: 'abort',
      aborted: true,
      localDataChanged: false,
      cloudDataChanged: false,
    });

    expect(runManualConflictResolutionCandidate({
      ...validInput('keep_cloud'),
      confirmed: false,
    })).toMatchObject({
      action: 'keep_cloud',
      confirmed: false,
      aborted: true,
      reason: 'Manual confirmation is required.',
    });
  });

  it('requires backup before destructive-looking candidates', () => {
    expect(runManualConflictResolutionCandidate({
      ...validInput('create_backup_then_replace_local'),
      backupCreated: false,
    })).toMatchObject({
      backupRequired: true,
      backupCreated: false,
      aborted: true,
      reason: 'Backup is required before this conflict resolution candidate.',
    });

    expect(runManualConflictResolutionCandidate({
      ...validInput('create_cloud_snapshot_from_local'),
      backupAvailable: false,
    })).toMatchObject({
      backupRequired: true,
      aborted: true,
    });
  });

  it('requires owner and schema validation', () => {
    expect(runManualConflictResolutionCandidate({
      ...validInput('keep_local'),
      ownerValidated: false,
    })).toMatchObject({
      ownerValidated: false,
      aborted: true,
      reason: 'Owner validation is required.',
    });

    expect(runManualConflictResolutionCandidate({
      ...validInput('keep_local'),
      schemaValidated: false,
    })).toMatchObject({
      schemaValidated: false,
      aborted: true,
      reason: 'Schema validation is required.',
    });
  });

  it('returns ready candidate without changing local or cloud data', () => {
    expect(runManualConflictResolutionCandidate(validInput('keep_local'))).toMatchObject({
      action: 'keep_local',
      confirmed: true,
      ownerValidated: true,
      schemaValidated: true,
      backupRequired: false,
      aborted: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('documents manual conflict resolution boundaries and next task', () => {
    const doc = readSource('docs/MANUAL_CONFLICT_RESOLUTION_CANDIDATE.md');

    for (const expected of [
      'Task 12.13 Manual Conflict Resolution Candidate V1',
      'Manual confirmation required.',
      'Backup required before destructive-looking actions.',
      'Owner validation required.',
      'Schema validation required.',
      'No automatic merge.',
      'No silent overwrite.',
      'No local emergency backup deletion.',
      'Recommended next task: Task 12.14 Cloud Operation Journal & Idempotency Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of route and automatic work behavior', () => {
    const source = readSource('src/cloudProduction/manualConflictResolutionCandidate.ts');

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
