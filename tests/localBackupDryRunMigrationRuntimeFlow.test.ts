import { describe, expect, it } from 'vitest';
import {
  buildLocalBackupDryRunMigrationRuntimeFlow,
  PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID,
  type Phase20eLocalBackupDryRunInput,
  type Phase20eSyncRuntimeLike,
} from '../src/cloudProduction/localBackupDryRunMigrationRuntimeFlow';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-24T21:00:00.000Z';

const appData = () => emptyData();

const syncRuntime = (): Phase20eSyncRuntimeLike => ({
  readyFor20E: true,
  syncRuntimeEnabled: true,
  user: {
    userId: 'account-1',
    accountId: 'account-1',
    displayName: 'Local User',
  },
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const cloudReadMirror = () => ({
  status: 'cloud_missing' as const,
  requiresManualReview: false,
});

const validInput = (
  overrides: Partial<Phase20eLocalBackupDryRunInput<AppData>> = {},
): Phase20eLocalBackupDryRunInput<AppData> => {
  const data = appData();
  return {
    enabled: true,
    syncRuntime: syncRuntime(),
    appData: data,
    backupJson: exportAppData(data),
    backupExportConfirmed: true,
    deviceId: 'device-1',
    schemaValidator: (value) => value.schemaVersion === emptyData().schemaVersion,
    cloudRepositoryAvailable: true,
    cloudReadMirror: cloudReadMirror(),
    rlsPreflightPassed: true,
    rollbackAvailable: true,
    nowIso,
    operationId: 'phase20e-operation-1',
    requestFingerprint: 'phase20e-request-1',
    flowId: 'phase20e-flow-1',
    ...overrides,
  };
};

describe('Phase 20E local backup and dry-run migration runtime flow', () => {
  it('is disabled by default and never moves data', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow();

    expect(result).toMatchObject({
      baseId: PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID,
      phase: '20E',
      ok: false,
      status: 'disabled',
      readyFor20F: false,
      syncRuntimeEnabled: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      localStorageFallbackPreserved: true,
      blockers: expect.arrayContaining([
        'flow_disabled',
        'sync_runtime_not_ready',
        'authenticated_user_missing',
      ]),
    });
  });

  it('builds backup metadata and a migration dry run after explicit sync runtime wiring', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input.appData));

    const result = buildLocalBackupDryRunMigrationRuntimeFlow(input);

    expect(result).toMatchObject({
      id: 'phase20e-flow-1',
      ok: true,
      status: 'ready_for_cloud_verification',
      readyFor20F: true,
      blockers: [],
      userMessage: '本地数据仍会保留',
      backup: {
        status: 'valid',
        checked: true,
        matchesCurrentLocal: true,
        generatedInMemory: false,
        exportRequiredBeforeFirstSync: true,
      },
      syncRuntimeEnabled: true,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      nextPhase: '20F - Cloud Read/Write Verification Flow V1',
      createdAt: nowIso,
    });
    expect(result.migrationDryRun).toMatchObject({
      ok: true,
      status: 'ready_for_shadow_candidate',
      readyForShadowCandidate: true,
      noUpload: true,
      noDownload: true,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      'backup_metadata_only',
      'dry_run_only',
      'no_upload_or_download',
      'localStorage_remains_fallback',
      'cloud_primary_not_enabled',
      'manual_review_before_write',
    ]));
    expect(input.appData).toEqual(before);
    expect(JSON.stringify(result)).not.toContain(input.backupJson as string);
  });

  it('can generate backup preflight metadata in memory when export is explicitly confirmed', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      backupJson: null,
      backupExportConfirmed: true,
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'ready_for_cloud_verification',
      backup: {
        status: 'valid',
        generatedInMemory: true,
        matchesCurrentLocal: true,
      },
      uploadPerformed: false,
      downloadPerformed: false,
      sourceOfTruthChanged: false,
    });
  });

  it('requires sync runtime readiness before backup or dry run can proceed', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      syncRuntime: {
        ...syncRuntime(),
        readyFor20E: false,
        syncRuntimeEnabled: false,
        user: null,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'sync_runtime_not_ready',
      readyFor20F: false,
      syncRuntimeEnabled: false,
      blockers: expect.arrayContaining([
        'sync_runtime_not_ready',
        'authenticated_user_missing',
      ]),
    });
  });

  it('blocks missing invalid or mismatched backup evidence', () => {
    const missing = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      backupJson: null,
      backupExportConfirmed: false,
    }));
    expect(missing).toMatchObject({
      ok: false,
      status: 'backup_missing',
      backup: { status: 'missing', generatedInMemory: false },
      blockers: expect.arrayContaining([
        'backup_export_confirmation_missing',
        'backup_missing',
      ]),
    });

    const invalid = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      backupJson: '{not-json',
    }));
    expect(invalid).toMatchObject({
      ok: false,
      status: 'backup_invalid',
      backup: { status: 'invalid' },
      blockers: expect.arrayContaining(['backup_invalid']),
    });

    const stale = appData();
    stale.bodyWeights = [{ date: '2026-05-20', value: 80 }];
    const mismatch = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      backupJson: exportAppData(stale),
    }));
    expect(mismatch).toMatchObject({
      ok: false,
      status: 'backup_mismatch',
      backup: { status: 'mismatch' },
      blockers: expect.arrayContaining(['backup_mismatch']),
    });
  });

  it('blocks dry-run risks without upload download or local mutation', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      cloudRepositoryAvailable: false,
      rlsPreflightPassed: false,
      rollbackAvailable: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'dry_run_blocked',
      readyFor20F: false,
      uploadPerformed: false,
      downloadPerformed: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      blockers: expect.arrayContaining([
        'cloud_repository_unavailable',
        'rls_preflight_failed',
        'rollback_unavailable',
      ]),
    });
  });

  it('blocks invalid schema evidence without changing data', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      schemaValidator: () => false,
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'dry_run_blocked',
      readyFor20F: false,
      uploadPerformed: false,
      downloadPerformed: false,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
      blockers: expect.arrayContaining(['schema_invalid']),
      migrationDryRun: {
        schemaStatus: 'invalid',
        noUpload: true,
        noDownload: true,
      },
    });
  });

  it('requires manual review when the dry run sees cloud conflict evidence', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      cloudReadMirror: {
        status: 'review_required',
        requiresManualReview: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_review_required',
      readyFor20F: false,
      blockers: expect.arrayContaining(['manual_review_required']),
      migrationDryRun: {
        requiresManualReview: true,
        noUpload: true,
        noDownload: true,
      },
    });
  });

  it('fails closed when runtime boundary evidence is already unsafe', () => {
    const result = buildLocalBackupDryRunMigrationRuntimeFlow(validInput({
      syncRuntime: {
        ...syncRuntime(),
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
      runtimeBoundary: {
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'dry_run_blocked',
      readyFor20F: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('uses deterministic ids when nowIso is fixed and no explicit id is supplied', () => {
    const input = validInput({ flowId: undefined });

    const first = buildLocalBackupDryRunMigrationRuntimeFlow(input);
    const second = buildLocalBackupDryRunMigrationRuntimeFlow(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
