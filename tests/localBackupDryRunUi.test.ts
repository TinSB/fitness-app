import { describe, expect, it } from 'vitest';
import {
  buildLocalBackupDryRunUi,
  type Phase21bLocalBackupDryRunUiInput,
} from '../src/cloudProduction/localBackupDryRunUi';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { emptyData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';

const nowIso = '2026-05-25T13:00:00.000Z';

const readyPreflight = (): Phase21aExplicitOptInSyncPreflightResult => ({
  id: 'phase21a-preflight-ready',
  baseId: 'phase21a-explicit-opt-in-sync-preflight',
  phase: '21A',
  ok: true,
  status: 'ready_for_backup_dry_run',
  readyFor21B: true,
  syncPreflightVisible: true,
  user: {
    userId: 'user-1',
    accountId: 'user-1',
    displayName: 'ironpath@example.test',
  },
  blockers: [],
  warnings: [
    'manual_opt_in_required',
    'backup_required_before_first_upload',
    'dry_run_required_before_first_upload',
    'localStorage_remains_fallback',
    'no_silent_overwrite',
    'no_default_sync',
    'no_background_sync',
    'cloud_primary_not_enabled',
  ],
  userMessage: '本地数据仍会保留',
  primaryActionLabel: '检查本地数据',
  secondaryActionLabels: ['开启前先备份', '查看将同步的内容'],
  requiresExplicitOptIn: true,
  requiresBackupBeforeFirstUpload: true,
  requiresDryRunBeforeFirstUpload: true,
  requiresManualConfirmationBeforeUpload: true,
  requiresConflictReviewBeforeApply: true,
  syncRuntimeEnabled: false,
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
  localStorageFallbackPreserved: true,
  serviceRoleExposed: false,
  secretsExposed: false,
  nextPhase: '21B - Local Backup Dry Run UI V1',
  createdAt: nowIso,
});

const validInput = (overrides: Partial<Phase21bLocalBackupDryRunUiInput> = {}): Phase21bLocalBackupDryRunUiInput => {
  const appData = emptyData();
  return {
    enabled: true,
    preflight: readyPreflight(),
    appData,
    backupJson: exportAppData(appData),
    backupExportConfirmed: true,
    dryRunRequested: true,
    schemaValidator: (value) => (value as { schemaVersion?: number }).schemaVersion === appData.schemaVersion,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
    ...overrides,
  };
};

describe('Phase 21B local backup dry-run UI', () => {
  it('is disabled by default and never moves data', () => {
    const result = buildLocalBackupDryRunUi();

    expect(result).toMatchObject({
      phase: '21B',
      ok: false,
      status: 'disabled',
      readyFor21C: false,
      backupReady: false,
      dryRunReady: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining(['ui_disabled']),
    });
  });

  it('requires 21A signed-in preflight before backup and preview are available', () => {
    const result = buildLocalBackupDryRunUi(validInput({
      preflight: {
        ...readyPreflight(),
        ok: false,
        readyFor21B: false,
        user: null,
        blockers: ['authenticated_user_missing'],
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'preflight_not_ready',
      readyFor21C: false,
      blockers: expect.arrayContaining(['phase21a_not_ready', 'signed_in_account_missing']),
      uploadPerformed: false,
      localStorageDeleted: false,
    });
  });

  it('requires a matching local backup before the dry-run preview can pass', () => {
    const missing = buildLocalBackupDryRunUi(validInput({
      backupJson: null,
      backupExportConfirmed: false,
      dryRunRequested: false,
    }));
    const staleData = emptyData();
    staleData.bodyWeights = [{ date: '2026-05-25', value: 80 }];
    const mismatch = buildLocalBackupDryRunUi(validInput({
      backupJson: exportAppData(staleData),
    }));

    expect(missing).toMatchObject({
      ok: false,
      status: 'backup_required',
      backupReady: false,
      dryRunReady: false,
      blockers: expect.arrayContaining(['backup_export_confirmation_missing', 'backup_missing']),
    });
    expect(mismatch).toMatchObject({
      ok: false,
      status: 'backup_mismatch',
      readyFor21C: false,
      blockers: expect.arrayContaining(['backup_mismatch']),
    });
  });

  it('separates backup readiness from the explicit dry-run preview request', () => {
    const result = buildLocalBackupDryRunUi(validInput({ dryRunRequested: false }));

    expect(result).toMatchObject({
      ok: false,
      status: 'dry_run_not_requested',
      backupReady: true,
      dryRunReady: false,
      dryRunPreviewVisible: false,
      blockers: expect.arrayContaining(['dry_run_request_missing']),
    });
  });

  it('passes only after backup and user-requested dry-run preview are complete', () => {
    const appData = emptyData();
    const result = buildLocalBackupDryRunUi(validInput({
      appData,
      backupJson: exportAppData(appData),
      uiId: 'phase21b-ui-1',
    }));

    expect(result).toMatchObject({
      id: 'phase21b-ui-1',
      ok: true,
      status: 'ready_for_shadow_candidate',
      readyFor21C: true,
      backupReady: true,
      dryRunReady: true,
      dryRunPreviewVisible: true,
      userMessage: '本地数据仍会保留',
      primaryActionLabel: '开启前先备份',
      secondaryActionLabels: ['检查本地数据', '查看将同步的内容'],
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      nextPhase: '21C - Cloud Write Shadow Candidate V1',
      createdAt: nowIso,
    });
    expect(result.dryRunPreview).toMatchObject({
      title: '查看将同步的内容',
      schemaVersion: appData.schemaVersion,
    });
    expect(result.dryRunPreview.items).toEqual(expect.arrayContaining([
      { label: '训练记录', value: '0' },
      { label: '本地指纹', value: expect.any(String) },
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      'backup_required_before_first_upload',
      'dry_run_required_before_first_upload',
      'first_upload_confirmation_still_required',
      'no_upload_or_download',
    ]));
  });

  it('fails closed on schema and runtime boundary risks', () => {
    const schemaBlocked = buildLocalBackupDryRunUi(validInput({
      schemaValidator: () => false,
    }));
    const unsafe = buildLocalBackupDryRunUi(validInput({
      runtimeBoundary: {
        syncRuntimeEnabled: true,
        liveCloudSyncActivated: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(schemaBlocked).toMatchObject({
      ok: false,
      status: 'dry_run_blocked',
      readyFor21C: false,
      blockers: expect.arrayContaining(['schema_invalid']),
      uploadPerformed: false,
      localStorageDeleted: false,
    });
    expect(unsafe).toMatchObject({
      ok: false,
      status: 'runtime_boundary_unsafe',
      readyFor21C: false,
      blockers: expect.arrayContaining([
        'sync_runtime_enabled',
        'live_sync_already_active',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    });
  });

  it('uses deterministic ids and does not mutate inputs', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const first = buildLocalBackupDryRunUi(input);
    const second = buildLocalBackupDryRunUi(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });
});
