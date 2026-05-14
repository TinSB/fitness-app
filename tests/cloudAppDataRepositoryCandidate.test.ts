import { describe, expect, it } from 'vitest';
import {
  createCloudAppDataRepositoryCandidate,
  type CloudAppDataOwner,
  type CloudAppDataSnapshotCandidate,
} from '../src/cloudProduction/cloudAppDataRepositoryCandidate';
import { createSupabaseClientAdapterCandidate } from '../src/cloudProduction/supabaseClientAdapterCandidate';
import { resolveSupabaseEnvironmentProjectGuard } from '../src/cloudProduction/supabaseEnvironmentProjectGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

type SyntheticAppData = {
  schemaVersion: string;
  workouts: string[];
};

const owner = (): CloudAppDataOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'user-synthetic-1',
  accountId: 'acct-synthetic-1',
  deviceId: 'device-synthetic-1',
});

const appData = (): SyntheticAppData => ({
  schemaVersion: 'phase-12-synthetic',
  workouts: ['synthetic-session'],
});

const safeGuard = () => resolveSupabaseEnvironmentProjectGuard({
  enabled: true,
  environment: 'production',
  projectUrl: 'https://project.supabase.co',
  anonKey: 'synthetic-anon-key',
});

const makeSnapshot = (
  data: SyntheticAppData = appData(),
  expectedOwner: CloudAppDataOwner = owner(),
): CloudAppDataSnapshotCandidate<SyntheticAppData> => ({
  snapshotId: 'snapshot-synthetic-1',
  accountId: expectedOwner.accountId ?? expectedOwner.ownerId,
  ownerUserId: expectedOwner.ownerId,
  owner: expectedOwner,
  appData: data,
  schemaVersion: data.schemaVersion,
  sourceSnapshotHash: 'hash-synthetic-1',
  operationId: 'operation-synthetic-1',
  validationStatus: 'valid',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const makeAdapter = (
  readSnapshot: CloudAppDataSnapshotCandidate<SyntheticAppData> | null,
  writeOk = true,
) => createSupabaseClientAdapterCandidate<
  CloudAppDataSnapshotCandidate<SyntheticAppData>,
  CloudAppDataSnapshotCandidate<SyntheticAppData>
>({
  enabled: true,
  projectGuard: safeGuard(),
  anonKeyCandidate: 'synthetic-anon-key',
  clientFactory: () => ({} as never),
  mockRead: () => readSnapshot
    ? {
        ok: true,
        status: 'read_candidate',
        data: readSnapshot,
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'Mocked read candidate.',
      }
    : {
        ok: false,
        status: 'failed',
        errorCode: 'read_failed',
        data: null,
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'No mocked cloud AppData snapshot.',
      },
  mockWrite: (snapshot) => writeOk
    ? {
        ok: true,
        status: 'write_candidate',
        data: snapshot,
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'Mocked write candidate.',
      }
    : {
        ok: false,
        status: 'failed',
        errorCode: 'write_failed',
        data: null,
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'Mocked write rejected.',
      },
});

const schemaValidator = (data: SyntheticAppData) =>
  data.schemaVersion === 'phase-12-synthetic' && Array.isArray(data.workouts);

describe('cloud AppData repository candidate', () => {
  it('is disabled by default and cannot become source-of-truth', () => {
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>();

    expect(repository).toMatchObject({
      enabled: false,
      notDefaultSource: true,
      explicitOptInRequired: true,
    });
    expect(repository.readLatestCloudAppDataCandidate()).toMatchObject({
      ok: false,
      status: 'disabled',
      errorCode: 'cloud_repository_disabled',
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
    });
  });

  it('requires an available adapter and matching cloud-account owner scope', () => {
    expect(createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      schemaValidator,
    }).readLatestCloudAppDataCandidate()).toMatchObject({
      ok: false,
      errorCode: 'cloud_adapter_unavailable',
    });

    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(makeSnapshot(appData(), { ...owner(), ownerId: 'other-user' })),
      schemaValidator,
    });

    expect(repository.readLatestCloudAppDataCandidate()).toMatchObject({
      ok: false,
      status: 'rejected',
      errorCode: 'owner_scope_mismatch',
      localStorageUnchanged: true,
    });
  });

  it('validates cloud AppData before read candidate returns data', () => {
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(makeSnapshot({ schemaVersion: 'wrong', workouts: [] })),
      schemaValidator,
    });

    expect(repository.readLatestCloudAppDataCandidate()).toMatchObject({
      ok: false,
      status: 'rejected',
      errorCode: 'cloud_appdata_invalid',
      sourceOfTruthChanged: false,
    });
  });

  it('reads latest cloud AppData candidate without applying it to localStorage', () => {
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(makeSnapshot()),
      schemaValidator,
    });

    expect(repository.readLatestCloudAppDataCandidate()).toMatchObject({
      ok: true,
      status: 'read_candidate',
      manualConfirmationRequired: true,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      snapshot: {
        snapshotId: 'snapshot-synthetic-1',
        validationStatus: 'valid',
      },
    });
  });

  it('creates cloud snapshot candidates without mutating input AppData', () => {
    const data = appData();
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(null),
      schemaValidator,
      now: () => '2026-01-02T00:00:00.000Z',
      snapshotIdFactory: () => 'snapshot-created',
    });

    const created = repository.createCloudSnapshotCandidate({
      appData: data,
      owner: owner(),
      schemaVersion: data.schemaVersion,
      sourceSnapshotHash: 'hash-local',
      operationId: 'operation-create',
    });

    expect(data).toEqual(appData());
    expect(created).toMatchObject({
      ok: true,
      status: 'snapshot_candidate',
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      snapshot: {
        snapshotId: 'snapshot-created',
        accountId: 'acct-synthetic-1',
        operationId: 'operation-create',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('requires manual confirmation before write candidate and validates write response', () => {
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(null),
      schemaValidator,
    });

    expect(repository.writeCloudAppDataCandidate({
      appData: appData(),
      owner: owner(),
      schemaVersion: 'phase-12-synthetic',
      sourceSnapshotHash: 'hash-local',
      operationId: 'operation-write',
    })).toMatchObject({
      ok: false,
      status: 'rejected',
      errorCode: 'manual_confirmation_required',
      manualConfirmationRequired: true,
    });
  });

  it('writes candidate data only through the mocked adapter boundary', () => {
    const repository = createCloudAppDataRepositoryCandidate<SyntheticAppData>({
      enabled: true,
      expectedOwner: owner(),
      adapter: makeAdapter(null),
      schemaValidator,
      snapshotIdFactory: () => 'snapshot-write-candidate',
    });

    expect(repository.writeCloudAppDataCandidate({
      appData: appData(),
      owner: owner(),
      schemaVersion: 'phase-12-synthetic',
      sourceSnapshotHash: 'hash-local',
      operationId: 'operation-write',
      manualConfirmation: true,
    })).toMatchObject({
      ok: true,
      status: 'write_candidate',
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      snapshot: {
        snapshotId: 'snapshot-write-candidate',
        validationStatus: 'valid',
      },
    });
  });

  it('documents repository boundaries and next task', () => {
    const doc = readSource('docs/ACCOUNT_SCOPED_CLOUD_APPDATA_REPOSITORY_CANDIDATE.md');

    for (const expected of [
      'Task 12.8 Account-Scoped Cloud AppData Repository Candidate V1',
      'Explicit opt-in only.',
      'Not default source-of-truth.',
      'No automatic sync.',
      'No localStorage overwrite.',
      'Manual confirmation is required before candidate writes.',
      'Recommended next task: Task 12.9 Local-to-Cloud Migration Dry Run V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of route and automatic work tokens', () => {
    const source = readSource('src/cloudProduction/cloudAppDataRepositoryCandidate.ts');

    for (const forbidden of [
      '/auth',
      '/account',
      '/sync',
      '/cloud',
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
      'localStorage.setItem',
      'fetch(',
      'node:http',
      'node:sqlite',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
