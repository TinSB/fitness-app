import { describe, expect, it } from 'vitest';
import {
  runLocalToCloudMigrationDryRun,
  type LocalToCloudOwner,
} from '../src/cloudProduction/localToCloudMigrationDryRun';
import { readSource } from './runtimeBoundaryTestHelpers';

type SyntheticAppData = {
  schemaVersion: string;
  workouts: string[];
};

const localOwner = (scope: LocalToCloudOwner['scope'] = 'device-local'): LocalToCloudOwner => ({
  scope,
  ownerId: scope === 'cloud-account-candidate' ? 'acct-synthetic-1' : 'local-synthetic-1',
  accountId: scope === 'cloud-account-candidate' ? 'acct-synthetic-1' : undefined,
  deviceId: 'device-synthetic-1',
});

const accountCandidate = (): LocalToCloudOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'acct-synthetic-1',
  accountId: 'acct-synthetic-1',
  deviceId: 'device-synthetic-1',
});

const appData = (): SyntheticAppData => ({
  schemaVersion: 'phase-12-synthetic',
  workouts: ['synthetic-session'],
});

const validInput = () => ({
  localOwner: localOwner(),
  accountCandidate: accountCandidate(),
  backendPrimaryCandidateReady: true,
  cloudRepositoryAvailable: true,
  appData: appData(),
  schemaValidator: (data: SyntheticAppData) => data.schemaVersion === 'phase-12-synthetic',
  migrationCompatible: true,
  backupAvailable: true,
  localSnapshotHash: 'hash-local',
  manualConfirmation: true,
});

describe('local-to-cloud migration dry run', () => {
  it('reports a safe candidate without changing local or cloud data', () => {
    const result = runLocalToCloudMigrationDryRun(validInput());

    expect(result).toMatchObject({
      ok: true,
      safeToUpload: true,
      warnings: [],
      blockingErrors: [],
      ownerBefore: { scope: 'device-local', ownerId: 'local-synthetic-1' },
      ownerAfterCandidate: { scope: 'cloud-account-candidate', accountId: 'acct-synthetic-1' },
      schemaStatus: 'valid',
      backupStatus: 'available',
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      estimatedCloudWrite: {
        operationType: 'create_cloud_appdata_snapshot_candidate',
        wouldWrite: true,
        accountId: 'acct-synthetic-1',
        sourceSnapshotHash: 'hash-local',
      },
    });
  });

  it('requires owner scope and account candidate before upload can be considered', () => {
    const result = runLocalToCloudMigrationDryRun({
      ...validInput(),
      localOwner: null,
      accountCandidate: localOwner('device-local'),
    });

    expect(result.safeToUpload).toBe(false);
    expect(result.blockingErrors).toEqual(expect.arrayContaining([
      'owner_scope_missing',
      'account_candidate_missing',
    ]));
    expect(result.estimatedCloudWrite.wouldWrite).toBe(false);
  });

  it('checks backend-primary readiness, repository availability, schema, compatibility, and backup', () => {
    const result = runLocalToCloudMigrationDryRun({
      ...validInput(),
      backendPrimaryCandidateReady: false,
      cloudRepositoryAvailable: false,
      appData: { schemaVersion: 'wrong', workouts: [] },
      migrationCompatible: false,
      backupAvailable: false,
    });

    expect(result).toMatchObject({
      ok: false,
      safeToUpload: false,
      schemaStatus: 'invalid',
      backupStatus: 'missing',
    });
    expect(result.blockingErrors).toEqual(expect.arrayContaining([
      'backend_primary_not_ready',
      'cloud_repository_unavailable',
      'schema_invalid',
      'migration_incompatible',
      'backup_missing',
    ]));
  });

  it('warns for anonymous local and backend-primary owners without mutating them', () => {
    expect(runLocalToCloudMigrationDryRun({
      ...validInput(),
      localOwner: localOwner('anonymous-local'),
    }).warnings).toContain('anonymous_local_requires_linking');

    const backend = runLocalToCloudMigrationDryRun({
      ...validInput(),
      localOwner: localOwner('backend-primary-candidate'),
    });
    expect(backend.warnings).toContain('backend_primary_candidate_detected');
    expect(backend.ownerBefore).toMatchObject({ scope: 'backend-primary-candidate' });
    expect(backend.localDataChanged).toBe(false);
  });

  it('detects owner mismatch and existing cloud conflicts', () => {
    const result = runLocalToCloudMigrationDryRun({
      ...validInput(),
      existingCloudOwner: {
        scope: 'cloud-account-candidate',
        ownerId: 'acct-other',
        accountId: 'acct-other',
      },
      existingCloudSnapshotHash: 'hash-cloud',
      localSnapshotHash: 'hash-local',
    });

    expect(result.safeToUpload).toBe(false);
    expect(result.warnings).toContain('existing_cloud_data_requires_review');
    expect(result.blockingErrors).toEqual(expect.arrayContaining([
      'owner_scope_mismatch',
      'existing_cloud_conflict',
    ]));
  });

  it('requires manual confirmation and still only estimates the candidate write', () => {
    const result = runLocalToCloudMigrationDryRun({
      ...validInput(),
      manualConfirmation: false,
    });

    expect(result.ok).toBe(true);
    expect(result.safeToUpload).toBe(false);
    expect(result.warnings).toContain('manual_confirmation_required');
    expect(result.estimatedCloudWrite).toMatchObject({
      wouldWrite: false,
      accountId: 'acct-synthetic-1',
    });
    expect(result.cloudDataChanged).toBe(false);
  });

  it('documents the dry run boundaries and next task', () => {
    const doc = readSource('docs/LOCAL_TO_CLOUD_MIGRATION_DRY_RUN.md');

    for (const expected of [
      'Task 12.9 Local-to-Cloud Migration Dry Run V1',
      'never uploads or mutates data',
      'safeToUpload',
      'ownerBefore',
      'ownerAfterCandidate',
      'localDataChanged: false',
      'cloudDataChanged: false',
      'sourceOfTruthChanged: false',
      'Recommended next task: Task 12.10 Cloud Read / Pull Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of cloud writes, route strings, and automatic work tokens', () => {
    const source = readSource('src/cloudProduction/localToCloudMigrationDryRun.ts');

    for (const forbidden of [
      '/auth',
      '/account',
      '/sync',
      '/cloud',
      'fetch(',
      'localStorage.setItem',
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
