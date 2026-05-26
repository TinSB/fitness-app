import { describe, expect, it } from 'vitest';
import {
  buildLocalBackupDryRunUi,
  type Phase21bLocalBackupDryRunUiInput,
} from '../src/cloudProduction/localBackupDryRunUi';
import type { Phase21aExplicitOptInSyncPreflightResult } from '../src/cloudProduction/explicitOptInSyncPreflight';
import { emptyData, sanitizeData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

const nowIso = '2026-05-26T13:00:00.000Z';

const readyPreflight = (): Phase21aExplicitOptInSyncPreflightResult => ({
  id: 'phase21a-preflight-ready',
  baseId: 'phase21a-explicit-opt-in-sync-preflight',
  phase: '21A',
  ok: true,
  status: 'ready_for_backup_dry_run',
  readyFor21B: true,
  syncPreflightVisible: true,
  user: { userId: 'user-1', accountId: 'user-1', displayName: 'ironpath@example.test' },
  blockers: [],
  warnings: [],
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

const baseInput = (appData: AppData): Phase21bLocalBackupDryRunUiInput<AppData> => ({
  enabled: true,
  preflight: readyPreflight(),
  appData,
  backupJson: exportAppData(appData),
  backupExportConfirmed: true,
  dryRunRequested: true,
  schemaValidator: () => true,
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
});

describe('localBackupDryRunUi hash parity (regression guard)', () => {
  it('marks backupReady=true when the in-memory appData was already canonical', () => {
    const appData = emptyData();
    const result = buildLocalBackupDryRunUi(baseInput(appData));
    expect(result.backupReady).toBe(true);
    expect(result.backup.matchesCurrentLocal).toBe(true);
    expect(result.backup.status).toBe('valid');
  });

  it('still marks backupReady=true when the in-memory appData is missing optional fields that sanitizeData fills in (production scenario)', () => {
    // sanitizeData fills in many optional fields with defaults (settings.*,
    // dataRepairLogs, dismissedDataHealthIssues, etc). In a real session the
    // running AppData has been through reducers since load and may have lost
    // those exact byte-identical fields (extra/missing dynamic timestamps,
    // empty arrays trimmed, etc). Before the fix the engine compared local
    // hash (raw appData) against backup hash (JSON.parse(exportAppData(...)))
    // which produced a permanent mismatch -> backupReady=false -> grey
    // toggle. This test pins the fix: the engine must normalize through the
    // same export pipeline before hashing.
    const canonical = emptyData();
    const drifted = {
      ...canonical,
      // remove the optional dataRepairLogs that sanitize would later fill
      // back in, simulating an in-memory delta that does not change the
      // logical state.
      settings: { ...canonical.settings, dataRepairLogs: undefined },
    } as unknown as AppData;

    expect(JSON.stringify(drifted)).not.toBe(JSON.stringify(sanitizeData(drifted)));

    const result = buildLocalBackupDryRunUi(baseInput(drifted));
    expect(result.backupReady).toBe(true);
    expect(result.backup.matchesCurrentLocal).toBe(true);
    expect(result.backup.status).toBe('valid');
  });

  it('exposes the dry-run preview once the user confirms the dry run', () => {
    const appData = emptyData();
    const result = buildLocalBackupDryRunUi({
      ...baseInput(appData),
      dryRunRequested: true,
    });
    expect(result.dryRunPreviewVisible).toBe(true);
    expect(result.dryRunReady).toBe(true);
    expect(result.dryRunPreview.title).toBe('查看将同步的内容');
  });

  it('keeps backup.status=mismatch when the user uploads a backup json that does not match the running appData', () => {
    const appData = emptyData();
    const otherAppData: AppData = { ...appData, trainingMode: appData.trainingMode === 'hybrid' ? 'strength' : 'hybrid' };
    const result = buildLocalBackupDryRunUi({
      ...baseInput(appData),
      backupJson: exportAppData(otherAppData),
    });
    expect(result.backup.status).toBe('mismatch');
    expect(result.backupReady).toBe(false);
  });
});
