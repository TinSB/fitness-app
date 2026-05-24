import { describe, expect, it } from 'vitest';
import {
  buildPhase19iLocalToCloudMigrationDryRun,
  PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID,
  runLocalToCloudMigrationDryRun,
  type Phase19iLocalToCloudMigrationDryRunInput,
} from '../src/cloudProduction/localToCloudMigrationDryRun';
import type { Phase19gCloudReadMirrorResult } from '../src/cloudProduction/cloudReadMirror';
import { buildAccountBoundaryLocalInventory } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { exportAppData } from '../src/storage/backup';
import { emptyData } from '../src/storage/appDataSanitize';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-24T02:00:00.000Z';

const appData = () => emptyData();

const readyInventory = (data: AppData = appData()) =>
  buildAccountBoundaryLocalInventory({
    appData: data,
    backupJson: exportAppData(data),
    cloudAccountId: 'acct-synthetic-1',
    ownerUserId: 'acct-synthetic-1',
    deviceId: 'device-synthetic-1',
    nowIso,
  });

const mirrorResult = (
  status: Phase19gCloudReadMirrorResult<AppData>['status'],
  requiresManualReview = false,
): Phase19gCloudReadMirrorResult<AppData> => ({
  id: 'phase19g-cloud-read-mirror',
  phase: '19G',
  ok: !['disabled', 'account_not_ready', 'repository_unavailable', 'rejected'].includes(status),
  status,
  mirror: null,
  requiresManualReview,
  blockers: requiresManualReview ? ['manual_review_required'] : [],
  applied: false,
  cloudWriteAttempted: false,
  localDataChanged: false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  message: 'Synthetic read mirror result.',
});

const validInput = (overrides: Partial<Phase19iLocalToCloudMigrationDryRunInput<AppData>> = {}) => ({
  enabled: true,
  accountInventory: readyInventory(),
  appData: appData(),
  schemaValidator: (data: AppData) => data.schemaVersion === emptyData().schemaVersion,
  cloudRepositoryAvailable: true,
  cloudReadMirror: mirrorResult('cloud_missing'),
  rlsPreflightPassed: true,
  rollbackAvailable: true,
  nowIso,
  operationId: 'operation-phase19i-1',
  requestFingerprint: 'request-phase19i-1',
  ...overrides,
});

describe('Phase 19I local-to-cloud migration dry run', () => {
  it('is disabled by default and never uploads downloads or mutates data', () => {
    const result = buildPhase19iLocalToCloudMigrationDryRun();

    expect(result).toMatchObject({
      baseId: PHASE19I_LOCAL_TO_CLOUD_MIGRATION_DRY_RUN_ID,
      phase: '19I',
      ok: false,
      status: 'disabled',
      readyForShadowCandidate: false,
      blockers: expect.arrayContaining(['dry_run_disabled']),
      noUpload: true,
      noDownload: true,
      localStorageUnchanged: true,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      syncRuntimeEnabled: false,
    });
    expect(result.migrationPackage).toMatchObject({
      dryRunOnly: true,
      wouldCreateSnapshotCandidate: false,
      willUpload: false,
      willDownload: false,
    });
  });

  it('builds a ready dry-run package from account inventory without changing local or cloud data', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input.accountInventory));
    const result = buildPhase19iLocalToCloudMigrationDryRun(input);

    expect(result).toMatchObject({
      ok: true,
      status: 'ready_for_shadow_candidate',
      readyForShadowCandidate: true,
      requiresManualReview: false,
      accountBoundaryStatus: 'ready_for_migration_dry_run',
      backupStatus: 'valid',
      schemaStatus: 'valid',
      rlsPreflight: 'passed',
      rollbackPreflight: 'available',
      cloudConflictPreflight: 'no_cloud_snapshot',
      blockers: [],
      noUpload: true,
      noDownload: true,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      nextPhase: '19J - Explicit Opt-In Single-User Sync Candidate V1',
      createdAt: nowIso,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'dry_run_only',
      'localStorage_remains_source_of_truth',
      'first_sync_requires_review',
      'shadow_write_still_requires_opt_in',
    ]));
    expect(result.migrationPackage).toMatchObject({
      operationType: 'migration_dry_run',
      targetTable: 'cloud_appdata_snapshots',
      operationId: 'operation-phase19i-1',
      requestFingerprint: 'request-phase19i-1',
      accountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-1',
      localOwnerId: input.accountInventory.localOwner?.ownerId,
      deviceId: 'device-synthetic-1',
      schemaVersion: input.accountInventory.appDataSummary?.schemaVersion,
      sourceSnapshotHash: input.accountInventory.appDataSummary?.sourceSnapshotHash,
      dryRunOnly: true,
      wouldCreateSnapshotCandidate: true,
      willUpload: false,
      willDownload: false,
    });
    expect(input.accountInventory).toEqual(before);
  });

  it('keeps the dry run blocked when account boundary backup or ownership is not ready', () => {
    const missingBackupInventory = buildAccountBoundaryLocalInventory({
      appData: appData(),
      backupJson: null,
      cloudAccountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-1',
      deviceId: 'device-synthetic-1',
      nowIso,
    });

    expect(buildPhase19iLocalToCloudMigrationDryRun(validInput({
      accountInventory: missingBackupInventory,
    }))).toMatchObject({
      ok: false,
      status: 'account_boundary_not_ready',
      backupStatus: 'missing',
      blockers: expect.arrayContaining(['account_boundary_not_ready', 'backup_missing']),
      readyForShadowCandidate: false,
      sourceOfTruthChanged: false,
    });

    const ownerMismatchInventory = buildAccountBoundaryLocalInventory({
      appData: appData(),
      backupJson: exportAppData(appData()),
      cloudAccountId: 'acct-synthetic-1',
      ownerUserId: 'acct-synthetic-2',
      deviceId: 'device-synthetic-1',
      nowIso,
    });

    expect(buildPhase19iLocalToCloudMigrationDryRun(validInput({
      accountInventory: ownerMismatchInventory,
    }))).toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      blockers: expect.arrayContaining(['owner_mismatch', 'rls_preflight_failed']),
    });
  });

  it('blocks invalid schema repository RLS and rollback preflights', () => {
    const result = buildPhase19iLocalToCloudMigrationDryRun(validInput({
      appData: { ...appData(), schemaVersion: -1 } as AppData,
      schemaValidator: () => false,
      cloudRepositoryAvailable: false,
      rlsPreflightPassed: false,
      rollbackAvailable: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      readyForShadowCandidate: false,
      schemaStatus: 'invalid',
      rlsPreflight: 'failed',
      rollbackPreflight: 'missing',
      blockers: expect.arrayContaining([
        'schema_invalid',
        'cloud_repository_unavailable',
        'rls_preflight_failed',
        'rollback_unavailable',
      ]),
      noUpload: true,
      localStorageUnchanged: true,
    });
  });

  it('requires review for read-mirror differences and rejects cloud conflicts without applying them', () => {
    const review = buildPhase19iLocalToCloudMigrationDryRun(validInput({
      cloudReadMirror: mirrorResult('review_required', true),
    }));

    expect(review).toMatchObject({
      ok: false,
      status: 'manual_review_required',
      requiresManualReview: true,
      cloudConflictPreflight: 'review_required',
      blockers: expect.arrayContaining(['manual_review_required']),
      warnings: expect.arrayContaining(['existing_cloud_data_requires_review']),
      cloudDataChanged: false,
    });

    const rejected = buildPhase19iLocalToCloudMigrationDryRun(validInput({
      cloudReadMirror: mirrorResult('rejected', true),
    }));

    expect(rejected).toMatchObject({
      ok: false,
      status: 'cloud_conflict',
      requiresManualReview: true,
      cloudConflictPreflight: 'rejected',
      blockers: expect.arrayContaining(['cloud_conflict']),
      noDownload: true,
    });
  });

  it('is deterministic when nowIso and operation id are supplied', () => {
    const input = validInput({ operationId: undefined, requestFingerprint: undefined });

    const first = buildPhase19iLocalToCloudMigrationDryRun(input);
    const second = buildPhase19iLocalToCloudMigrationDryRun(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(first.migrationPackage.operationId).toBe(second.migrationPackage.operationId);
    expect(first.migrationPackage.requestFingerprint).toBe(first.migrationPackage.operationId);
  });

  it('preserves the legacy Task 12 dry-run API as a compatibility helper', () => {
    const result = runLocalToCloudMigrationDryRun({
      localOwner: { scope: 'device-local', ownerId: 'local-synthetic-1' },
      accountCandidate: { scope: 'cloud-account-candidate', ownerId: 'acct-synthetic-1', accountId: 'acct-synthetic-1' },
      backendPrimaryCandidateReady: true,
      cloudRepositoryAvailable: true,
      appData: { schemaVersion: 'phase-12-synthetic' },
      schemaValidator: (data: { schemaVersion: string }) => data.schemaVersion === 'phase-12-synthetic',
      migrationCompatible: true,
      backupAvailable: true,
      localSnapshotHash: 'hash-local',
      manualConfirmation: true,
    });

    expect(result).toMatchObject({
      ok: true,
      safeToUpload: true,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });
});
