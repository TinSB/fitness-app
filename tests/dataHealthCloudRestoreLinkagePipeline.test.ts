import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import {
  ingressSourceDefaults,
  processIncomingAppData,
} from '../src/dataHealth/appDataIngressPipeline';
import { evaluateCloudUploadEligibility } from '../src/dataHealth/uploadEligibility';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import {
  type AutoRepairBackupAdapter,
  type AutoRepairBackupRecord,
} from '../src/dataHealth/autoRepairBackupAdapter';

const FIXTURE_PATH = resolve(__dirname, './fixtures/data-health/ironpath-2026-05-27-redacted.json');

const loadFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const memoryAdapter = (): AutoRepairBackupAdapter & { snapshots: number; failNext: boolean } => {
  const adapter: AutoRepairBackupAdapter & { snapshots: number; failNext: boolean } = {
    snapshots: 0,
    failNext: false,
    snapshot: async (params): Promise<AutoRepairBackupRecord> => {
      if (adapter.failNext) {
        throw new Error('backup adapter unavailable');
      }
      adapter.snapshots += 1;
      return {
        id: `mem-${Date.now()}-${adapter.snapshots}`,
        createdAt: new Date().toISOString(),
        triggeredBy: params.triggeredBy,
        appDataHashBefore: params.appDataHashBefore,
        repairIdScope: [...params.repairIdScope],
        payloadSize: 0,
        storage: 'memory',
      };
    },
    list: async () => [],
  };
  return adapter;
};

describe('dataHealthCloudRestoreLinkagePipeline — central ingress API', () => {
  it('dataHealthCloudRestoreLinkageImportTriggersOrchestrator', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'import-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(true);
    expect(result.shouldPersist).toBe(true);
    expect(result.repairedAppData).toBeDefined();
    expect(result.passiveStatus.tone).toBe('auto-repaired');
  });

  it('dataHealthCloudRestoreLinkageBackupRestoreTriggersOrchestrator', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'backup-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(true);
    expect(result.shouldPersist).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageCloudRestoreRunsBeforeTrainingDecision', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'cloud-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(true);
    expect(result.shouldBlockCloudUpload).toBe(false);
    // Repaired data is the upload-eligible candidate that should feed TrainingDecision.
    expect(result.repairedAppData).toBeDefined();
  });

  it('dataHealthCloudRestoreLinkageReadMirrorReturnsCleanedSnapshot', async () => {
    const data = loadFixture();
    const result = await processIncomingAppData({
      source: 'read-mirror',
      appData: data,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(false);
    expect(result.shouldPersist).toBe(false);
    expect(result.cleanView.guardDiagnostics.lifecycleResidueSessionIds.length).toBeGreaterThan(0);
  });

  it('dataHealthCloudRestoreLinkageLocalStorageBootStillProtected', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(true);
    expect(result.shouldPersist).toBe(true);
  });

  it('dataHealthCloudRestoreLinkagePostSessionCompleteNoInfiniteLoop', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const first = await processIncomingAppData({
      source: 'post-session-complete',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(first.triggeredOrchestrator).toBe(true);
    const second = await processIncomingAppData({
      source: 'post-session-complete',
      appData: first.repairedAppData ?? data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:05Z'),
    });
    // Second run should converge: either no mutation or the same idempotent set.
    expect(second.uploadEligibility.pendingRepairs).toBeLessThanOrEqual(first.uploadEligibility.pendingRepairs);
  });

  it('dataHealthCloudRestoreLinkagePreCloudUploadBlocksPartiallyRepaired', async () => {
    const data = loadFixture();
    const result = await processIncomingAppData({
      source: 'pre-cloud-upload',
      appData: data,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.shouldBlockCloudUpload).toBe(true);
    expect(result.uploadEligibility.eligible).toBe(false);
    expect(result.uploadEligibility.pendingRepairs).toBeGreaterThan(0);
  });

  it('dataHealthCloudRestoreLinkageRepairedWithReceiptBecomesUploadEligible', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const repaired = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(repaired.repairedAppData).toBeDefined();
    const upload = await processIncomingAppData({
      source: 'pre-cloud-upload',
      appData: repaired.repairedAppData!,
      now: () => new Date('2026-05-27T00:00:01Z'),
    });
    expect(upload.uploadEligibility.eligible).toBe(true);
    expect(upload.shouldBlockCloudUpload).toBe(false);
  });

  it('dataHealthCloudRestoreLinkageBackupFailureNoMutationButGuardActive', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    adapter.failNext = true;
    const result = await processIncomingAppData({
      source: 'import-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.shouldPersist).toBe(false);
    expect(result.repairedAppData).toBeUndefined();
    // Runtime Guard remains active — the clean view still strips legacy advice.
    expect(result.cleanView.guardDiagnostics.legacyAdviceSessionIds.length).toBeGreaterThan(0);
    expect(result.cleanView.guardDiagnostics.lifecycleResidueSessionIds.length).toBeGreaterThan(0);
  });

  it('dataHealthCloudRestoreLinkageCloudParityTreatsRepairedAsExpectedDrift', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const repaired = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const parity = await processIncomingAppData({
      source: 'cloud-parity',
      appData: repaired.repairedAppData!,
      now: () => new Date('2026-05-27T00:00:05Z'),
    });
    expect(parity.uploadEligibility.eligible).toBe(true);
    expect(parity.uploadEligibility.ledgerHashMatches).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageAuditOnlyDoesNotBlockUpload', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const repaired = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const upload = evaluateCloudUploadEligibility(repaired.repairedAppData!, {
      now: () => new Date('2026-05-27T00:00:01Z'),
    });
    // Audit-only findings remain after safe-auto repairs; they MUST NOT block upload.
    expect(upload.eligible).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageAccountSwitchPreventsStaleApplication', async () => {
    const dataA = loadFixture();
    const dataB = { ...loadFixture(), userProfile: { ...loadFixture().userProfile, id: 'account-B' } };
    const adapter = memoryAdapter();
    const opA = await processIncomingAppData({
      source: 'account-switch',
      appData: dataA,
      accountId: 'account-A',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const opB = await processIncomingAppData({
      source: 'account-switch',
      appData: dataB,
      accountId: 'account-B',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:01Z'),
    });
    expect(opA.operationId.includes('account-A')).toBe(true);
    expect(opB.operationId.includes('account-B')).toBe(true);
    expect(opA.operationId).not.toBe(opB.operationId);
  });

  it('dataHealthCloudRestoreLinkageBootRepairAndCloudPullConcurrentUsesLatest', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const [boot, pull] = await Promise.all([
      processIncomingAppData({
        source: 'boot',
        appData: data,
        backupAdapter: adapter,
        now: () => new Date('2026-05-27T00:00:00Z'),
      }),
      processIncomingAppData({
        source: 'cloud-pull',
        appData: data,
        now: () => new Date('2026-05-27T00:00:00Z'),
      }),
    ]);
    expect(boot.triggeredOrchestrator).toBe(true);
    expect(pull.triggeredOrchestrator).toBe(false);
    // Both operations have distinct operationIds — no overwrite risk.
    expect(boot.operationId).not.toBe(pull.operationId);
  });

  it('dataHealthCloudRestoreLinkageTrainingDecisionAlwaysCleanView', () => {
    const data = loadFixture();
    const pipelineResult = buildEnginePipeline(data, '2026-05-27', { trainingMode: data.trainingMode });
    expect(pipelineResult.cleanAppDataView).toBeTruthy();
    pipelineResult.context.allHistory.forEach((session) => {
      if (!session.completed) return;
      expect(session.restTimerState?.isRunning ?? false).toBe(false);
    });
  });

  it('dataHealthCloudRestoreLinkagePassiveRowNoModal', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'import-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    // Passive status renders as a single line of Chinese text; no modal/popup shape.
    expect(typeof result.passiveStatus.line).toBe('string');
    expect(result.passiveStatus.line.length).toBeGreaterThan(0);
    expect(result.passiveStatus.tone).toMatch(/ok|auto-repaired|audit-pending|backup-failed|busy/);
  });

  it('dataHealthCloudRestoreLinkageLedgerPerAccountSafe', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'account-switch',
      appData: data,
      accountId: 'account-A',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.operationId).toContain('account-A');
    // Ledger lives inside AppData.settings, scoped to the AppData snapshot itself.
    const ledger = result.repairedAppData?.settings?.dataHealthRepairLedger as unknown as Array<{
      repairId: string;
    }>;
    expect(Array.isArray(ledger)).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageLocalStorageNotCleared', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const before = JSON.stringify(data).length;
    const result = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const after = JSON.stringify(result.repairedAppData ?? data).length;
    // Repair never deletes data — only normalizes a small subset.
    expect(after).toBeGreaterThan(before * 0.95);
    expect(result.repairedAppData?.history.length).toBe(data.history.length);
  });

  it('dataHealthCloudRestoreLinkageCloudSnapshotNotSilentlyOverwritten', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'cloud-restore',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    // The orchestrator inside the pipeline produces a NEW AppData with receipts;
    // it does NOT call any cloud-side write API directly. Verify pipeline result
    // does not include any cloud-push surface.
    expect((result as unknown as { cloudPushed?: unknown }).cloudPushed).toBeUndefined();
  });

  it('dataHealthCloudRestoreLinkageSchemaUnchanged', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await processIncomingAppData({
      source: 'boot',
      appData: data,
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect((result.repairedAppData ?? data).schemaVersion).toBe(data.schemaVersion);
  });

  it('dataHealthCloudRestoreLinkageIngressSourceDefaultsAreExhaustive', () => {
    const sources: Array<Parameters<typeof ingressSourceDefaults>[0]> = [
      'boot',
      'localStorage-load',
      'import-restore',
      'backup-restore',
      'cloud-restore',
      'cloud-pull',
      'read-mirror',
      'cloud-parity',
      'account-switch',
      'post-session-complete',
      'pre-training-decision',
      'pre-cloud-upload',
      'export',
    ];
    sources.forEach((source) => {
      const defaults = ingressSourceDefaults(source);
      expect(defaults).toBeDefined();
      expect(['check', 'enforce', 'ignore']).toContain(defaults.uploadEligibilityMode);
    });
  });

  it('dataHealthCloudRestoreLinkagePreTrainingDecisionIsPure', async () => {
    const data = loadFixture();
    const before = JSON.stringify(data);
    const result = await processIncomingAppData({
      source: 'pre-training-decision',
      appData: data,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.triggeredOrchestrator).toBe(false);
    expect(result.shouldPersist).toBe(false);
    expect(result.shouldBlockCloudUpload).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
    expect(result.cleanView).toBeDefined();
  });

  it('dataHealthCloudRestoreLinkageCleanViewIsPureForExport', async () => {
    const data = loadFixture();
    const before = JSON.stringify(data);
    const result = await processIncomingAppData({
      source: 'export',
      appData: data,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.shouldPersist).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('dataHealthCloudRestoreLinkageCleanViewMatchesEnginePipeline', () => {
    const data = loadFixture();
    const enginePipeline = buildEnginePipeline(data, '2026-05-27', { trainingMode: data.trainingMode });
    const directCleanView = buildCleanAppDataView(data);
    // Both projections should agree on dirty-data diagnostics.
    expect(enginePipeline.cleanAppDataView.guardDiagnostics.lifecycleResidueSessionIds.length)
      .toBe(directCleanView.guardDiagnostics.lifecycleResidueSessionIds.length);
  });
});
