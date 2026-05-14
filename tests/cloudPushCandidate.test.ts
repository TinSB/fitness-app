import { describe, expect, it } from 'vitest';
import {
  runCloudPushCandidate,
  type CloudPushOwner,
} from '../src/cloudProduction/cloudPushCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

type SyntheticAppData = {
  schemaVersion: string;
  workouts: string[];
};

const owner = (): CloudPushOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'acct-synthetic-1',
  accountId: 'acct-synthetic-1',
});

const appData = (): SyntheticAppData => ({
  schemaVersion: 'phase-12-synthetic',
  workouts: ['synthetic-session'],
});

const validInput = () => ({
  enabled: true,
  explicitOptIn: true,
  manualConfirmation: true,
  dryRunPassed: true,
  expectedOwner: owner(),
  sourceOwner: owner(),
  backupAvailable: true,
  schemaValidator: (data: SyntheticAppData) => data.schemaVersion === 'phase-12-synthetic',
  appData: appData(),
  cloudConflictDetected: false,
  writeAdapter: () => ({
    ok: true,
    rollbackAvailable: true,
    message: 'Mocked cloud write candidate accepted.',
  }),
});

describe('cloud write push candidate', () => {
  it('is disabled by default and does not fake success', () => {
    expect(runCloudPushCandidate()).toMatchObject({
      ok: false,
      noFakeSuccess: true,
      cloudWriteCandidateStatus: 'disabled',
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('requires explicit opt-in, manual confirmation, and dry run', () => {
    expect(runCloudPushCandidate({
      ...validInput(),
      explicitOptIn: false,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'disabled',
    });

    expect(runCloudPushCandidate({
      ...validInput(),
      manualConfirmation: false,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'manual_confirmation_missing',
    });

    expect(runCloudPushCandidate({
      ...validInput(),
      dryRunPassed: false,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'dry_run_missing',
    });
  });

  it('requires owner check, backup check, and schema validation', () => {
    expect(runCloudPushCandidate({
      ...validInput(),
      sourceOwner: { ...owner(), ownerId: 'acct-other', accountId: 'acct-other' },
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'owner_mismatch',
    });

    expect(runCloudPushCandidate({
      ...validInput(),
      backupAvailable: false,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'backup_missing',
    });

    expect(runCloudPushCandidate({
      ...validInput(),
      appData: { schemaVersion: 'wrong', workouts: [] },
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'schema_invalid',
    });
  });

  it('blocks cloud conflict and unavailable write adapter', () => {
    expect(runCloudPushCandidate({
      ...validInput(),
      cloudConflictDetected: true,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'cloud_conflict',
    });

    expect(runCloudPushCandidate({
      ...validInput(),
      writeAdapter: null,
    })).toMatchObject({
      ok: false,
      cloudWriteCandidateStatus: 'write_rejected',
      rollbackAvailable: false,
    });
  });

  it('reports rejected writes with rollback available and no local mutation', () => {
    expect(runCloudPushCandidate({
      ...validInput(),
      writeAdapter: () => ({
        ok: false,
        rollbackAvailable: true,
        message: 'Mocked write rejected.',
      }),
    })).toMatchObject({
      ok: false,
      noFakeSuccess: true,
      cloudWriteCandidateStatus: 'write_rejected',
      rollbackAvailable: true,
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('accepts a manually confirmed write candidate without changing source-of-truth', () => {
    expect(runCloudPushCandidate(validInput())).toMatchObject({
      ok: true,
      noFakeSuccess: true,
      cloudWriteCandidateStatus: 'write_candidate_success',
      rollbackAvailable: true,
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('documents push candidate boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_WRITE_PUSH_CANDIDATE.md');

    for (const expected of [
      'Task 12.11 Cloud Write / Push Candidate V1',
      'Disabled by default.',
      'Explicit opt-in required.',
      'Manual confirmation required.',
      'Dry run required before push.',
      'Owner check required.',
      'Backup check required.',
      'Schema validation required.',
      'Recommended next task: Task 12.12 Cloud Sync Conflict Detection V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of route and automatic work behavior', () => {
    const source = readSource('src/cloudProduction/cloudPushCandidate.ts');

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
      'node:http',
      'node:sqlite',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
