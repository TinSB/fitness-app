import { describe, expect, it } from 'vitest';
import {
  runCloudPullCandidate,
  type CloudPullOwner,
  type CloudPullSnapshot,
} from '../src/cloudProduction/cloudPullCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

type SyntheticAppData = {
  schemaVersion: string;
  workouts: string[];
};

const owner = (): CloudPullOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'acct-synthetic-1',
  accountId: 'acct-synthetic-1',
});

const snapshot = (overrides: Partial<CloudPullSnapshot<SyntheticAppData>> = {}): CloudPullSnapshot<SyntheticAppData> => ({
  snapshotId: 'snapshot-synthetic-1',
  owner: owner(),
  appData: {
    schemaVersion: 'phase-12-synthetic',
    workouts: ['synthetic-session'],
  },
  schemaVersion: 'phase-12-synthetic',
  sourceSnapshotHash: 'hash-cloud',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const baseInput = () => ({
  enabled: true,
  explicitOptIn: true,
  cloudAvailable: true,
  expectedOwner: owner(),
  localSchemaVersion: 'phase-12-synthetic',
  localSnapshotHash: 'hash-local',
  localUpdatedAt: '2026-01-02T00:00:00.000Z',
  cloudSnapshot: snapshot(),
  schemaValidator: (data: SyntheticAppData) => data.schemaVersion === 'phase-12-synthetic',
});

describe('cloud read pull candidate', () => {
  it('is disabled by default and requires explicit opt-in', () => {
    expect(runCloudPullCandidate()).toMatchObject({
      ok: false,
      status: 'disabled',
      pullCandidate: null,
      applied: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
    });

    expect(runCloudPullCandidate({
      enabled: true,
      explicitOptIn: false,
      cloudAvailable: true,
      cloudSnapshot: snapshot(),
    })).toMatchObject({
      ok: false,
      status: 'disabled',
      applied: false,
    });
  });

  it('reports cloud unavailable and missing cloud data without applying anything', () => {
    expect(runCloudPullCandidate({
      ...baseInput(),
      cloudAvailable: false,
    })).toMatchObject({
      ok: false,
      status: 'cloud_unavailable',
      applied: false,
      localStorageUnchanged: true,
    });

    expect(runCloudPullCandidate({
      ...baseInput(),
      cloudSnapshot: null,
    })).toMatchObject({
      ok: false,
      status: 'cloud_data_missing',
      sourceOfTruthChanged: false,
    });
  });

  it('rejects owner mismatch, invalid cloud data, and schema mismatch', () => {
    expect(runCloudPullCandidate({
      ...baseInput(),
      expectedOwner: { ...owner(), ownerId: 'acct-other', accountId: 'acct-other' },
    })).toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      requiresManualConfirmation: true,
    });

    expect(runCloudPullCandidate({
      ...baseInput(),
      cloudSnapshot: snapshot({ snapshotId: '' }),
    })).toMatchObject({
      ok: false,
      status: 'cloud_data_invalid',
    });

    expect(runCloudPullCandidate({
      ...baseInput(),
      localSchemaVersion: 'different-schema',
    })).toMatchObject({
      ok: false,
      status: 'schema_mismatch',
      applied: false,
    });
  });

  it('detects cloud newer and local newer without overwriting localStorage', () => {
    expect(runCloudPullCandidate({
      ...baseInput(),
      localUpdatedAt: '2026-01-01T00:00:00.000Z',
    })).toMatchObject({
      ok: true,
      status: 'cloud_newer',
      requiresManualConfirmation: true,
      localStorageUnchanged: true,
    });

    expect(runCloudPullCandidate({
      ...baseInput(),
      localUpdatedAt: '2026-01-03T00:00:00.000Z',
    })).toMatchObject({
      ok: true,
      status: 'local_newer',
      applied: false,
    });
  });

  it('requires manual confirmation and still never applies the pull result', () => {
    expect(runCloudPullCandidate(baseInput())).toMatchObject({
      ok: true,
      status: 'manual_confirmation_required',
      requiresManualConfirmation: true,
      applied: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      pullCandidate: {
        snapshotId: 'snapshot-synthetic-1',
      },
    });

    expect(runCloudPullCandidate({
      ...baseInput(),
      manualConfirmation: true,
    })).toMatchObject({
      ok: true,
      status: 'ready_candidate',
      requiresManualConfirmation: true,
      applied: false,
    });
  });

  it('documents pull candidate boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_READ_PULL_CANDIDATE.md');

    for (const expected of [
      'Task 12.10 Cloud Read / Pull Candidate V1',
      'Disabled by default.',
      'Explicit opt-in required.',
      'Do not apply to localStorage.',
      'localStorageUnchanged: true',
      'sourceOfTruthChanged: false',
      'Recommended next task: Task 12.11 Cloud Write / Push Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of apply, route, and automatic work behavior', () => {
    const source = readSource('src/cloudProduction/cloudPullCandidate.ts');

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
