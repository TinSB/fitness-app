import { describe, expect, it } from 'vitest';
import {
  buildPhase19gCloudReadMirror,
  PHASE19G_CLOUD_READ_MIRROR_ID,
  type Phase19gCloudReadMirrorRepository,
} from '../src/cloudProduction/cloudReadMirror';
import type {
  CloudAppDataOwner,
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';

type SyntheticAppData = {
  schemaVersion: string;
  sessions: string[];
};

const owner = (): CloudAppDataOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'acct-synthetic-1',
  accountId: 'acct-synthetic-1',
});

const snapshot = (
  overrides: Partial<CloudAppDataSnapshotCandidate<SyntheticAppData>> = {},
): CloudAppDataSnapshotCandidate<SyntheticAppData> => ({
  snapshotId: 'cloud-snapshot-synthetic-1',
  accountId: 'acct-synthetic-1',
  ownerUserId: 'acct-synthetic-1',
  owner: owner(),
  appData: {
    schemaVersion: 'phase-19-synthetic',
    sessions: ['session-a'],
  },
  schemaVersion: 'phase-19-synthetic',
  sourceSnapshotHash: 'hash-cloud',
  operationId: 'operation-read-mirror-1',
  validationStatus: 'valid',
  createdAt: '2026-05-24T00:05:00.000Z',
  ...overrides,
});

const repoResult = (
  result: CloudAppDataRepositoryCandidateResult<SyntheticAppData>,
): Phase19gCloudReadMirrorRepository<SyntheticAppData> => ({
  readLatestCloudAppDataCandidate: () => result,
});

const repositoryWithSnapshot = (
  cloudSnapshot = snapshot(),
): Phase19gCloudReadMirrorRepository<SyntheticAppData> =>
  repoResult({
    ok: true,
    status: 'read_candidate',
    snapshot: cloudSnapshot,
    localStorageUnchanged: true,
    sourceOfTruthChanged: false,
    manualConfirmationRequired: true,
    message: 'Synthetic read candidate.',
  });

const baseInput = () => ({
  enabled: true,
  accountReady: true,
  expectedOwner: owner(),
  repository: repositoryWithSnapshot(),
  localSnapshot: {
    schemaVersion: 'phase-19-synthetic',
    sourceSnapshotHash: 'hash-local',
    updatedAt: '2026-05-24T00:00:00.000Z',
  },
  schemaValidator: (appData: SyntheticAppData) => appData.schemaVersion === 'phase-19-synthetic',
});

describe('Phase 19G cloud read mirror', () => {
  it('is disabled by default and never mutates local state', () => {
    expect(buildPhase19gCloudReadMirror()).toMatchObject({
      id: PHASE19G_CLOUD_READ_MIRROR_ID,
      phase: '19G',
      ok: false,
      status: 'disabled',
      mirror: null,
      applied: false,
      cloudWriteAttempted: false,
      localDataChanged: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      blockers: ['read_mirror_disabled'],
    });
  });

  it('requires account readiness and repository availability', () => {
    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      accountReady: false,
    })).toMatchObject({
      ok: false,
      status: 'account_not_ready',
      blockers: ['account_not_ready'],
      mirror: null,
    });

    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      repository: null,
    })).toMatchObject({
      ok: false,
      status: 'repository_unavailable',
      blockers: ['repository_unavailable'],
    });
  });

  it('mirrors cloud snapshot metadata and compares cloud newer state without applying', () => {
    const result = buildPhase19gCloudReadMirror(baseInput());

    expect(result).toMatchObject({
      ok: true,
      status: 'review_required',
      requiresManualReview: true,
      applied: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      mirror: {
        snapshotId: 'cloud-snapshot-synthetic-1',
        schemaVersion: 'phase-19-synthetic',
        sourceSnapshotHash: 'hash-cloud',
        localSnapshotHash: 'hash-local',
        freshness: 'cloud_newer',
        hashMatch: false,
        ownerMatch: true,
        schemaMatch: true,
      },
    });
  });

  it('marks equal hashes and same timestamps as mirrored without review pressure', () => {
    const result = buildPhase19gCloudReadMirror({
      ...baseInput(),
      repository: repositoryWithSnapshot(snapshot({
        sourceSnapshotHash: 'hash-local',
        createdAt: '2026-05-24T00:00:00.000Z',
      })),
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'mirrored',
      requiresManualReview: false,
      mirror: {
        freshness: 'same_updated_at',
        hashMatch: true,
      },
    });
  });

  it('rejects owner mismatch and schema mismatch without applying', () => {
    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      expectedOwner: { ...owner(), ownerId: 'acct-other', accountId: 'acct-other' },
    })).toMatchObject({
      ok: false,
      status: 'rejected',
      requiresManualReview: true,
      blockers: ['owner_mismatch'],
      applied: false,
    });

    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      localSnapshot: {
        schemaVersion: 'phase-20-synthetic',
        sourceSnapshotHash: 'hash-local',
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
    })).toMatchObject({
      ok: false,
      status: 'rejected',
      blockers: ['schema_mismatch'],
    });
  });

  it('surfaces repository not-found and invalid read results without fake success', () => {
    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      repository: repoResult({
        ok: false,
        status: 'not_found',
        errorCode: 'cloud_appdata_not_found',
        snapshot: null,
        localStorageUnchanged: true,
        sourceOfTruthChanged: false,
        manualConfirmationRequired: false,
        message: 'No synthetic snapshot.',
      }),
    })).toMatchObject({
      ok: false,
      status: 'cloud_missing',
      blockers: ['cloud_appdata_not_found'],
    });

    expect(buildPhase19gCloudReadMirror({
      ...baseInput(),
      repository: repositoryWithSnapshot(snapshot({ snapshotId: '' })),
    })).toMatchObject({
      ok: false,
      status: 'rejected',
      blockers: ['cloud_data_invalid'],
    });
  });
});
