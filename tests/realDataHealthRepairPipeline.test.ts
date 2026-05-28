import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import {
  runAutoRepairOrchestrator,
  readAutoRepairSummary,
} from '../src/dataHealth/autoRepairOrchestrator';
import {
  createAutoRepairBackupAdapter,
  __test_clearInMemoryBackups,
  type AutoRepairBackupAdapter,
} from '../src/dataHealth/autoRepairBackupAdapter';
import { readLedger } from '../src/dataHealth/appDataRepairLedger';
import { buildEnginePipeline } from '../src/engines/enginePipeline';

const FIXTURE_PATH = resolve(__dirname, './fixtures/data-health/ironpath-2026-05-27-redacted.json');

const loadFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const memoryAdapter = (): AutoRepairBackupAdapter & { snapshots: number; failNext: boolean } => {
  const adapter: AutoRepairBackupAdapter & { snapshots: number; failNext: boolean } = {
    snapshots: 0,
    failNext: false,
    snapshot: async (params) => {
      if (adapter.failNext) {
        throw new Error('backup adapter unavailable');
      }
      adapter.snapshots += 1;
      return {
        id: `mem-${Date.now()}`,
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

describe('realDataHealthRepairPipeline — automation-first orchestration', () => {
  it('realDataHealthRepairStartupPipelineProducesCleanAppDataViewBeforeTrainingDecision', () => {
    const data = loadFixture();
    const pipeline = buildEnginePipeline(data, '2026-05-27', { trainingMode: data.trainingMode });
    expect(pipeline.cleanAppDataView).toBeTruthy();
    expect(pipeline.cleanAppDataView.guardDiagnostics.lifecycleResidueSessionIds.length).toBeGreaterThanOrEqual(10);
    // TrainingDecision context built off CleanAppDataView, not raw — completed sessions look closed in it.
    pipeline.context.allHistory.forEach((session) => {
      if (!session.completed) return;
      expect(session.restTimerState?.isRunning ?? false).toBe(false);
      expect(session.currentExerciseId).toBe('');
    });
  });

  it('realDataHealthRepairTrainingDecisionLegacyFieldGuardInClean', () => {
    const data = loadFixture();
    const view = buildCleanAppDataView(data, { now: () => new Date('2026-05-27T00:00:00Z') });
    view.appData.history.forEach((session) => {
      expect(session.explanations ?? []).toEqual([]);
      expect(session.deloadDecision).toBeUndefined();
      (session.exercises || []).forEach((exercise) => {
        expect(exercise.suggestion ?? '').toBe('');
        expect(exercise.adjustment ?? '').toBe('');
        expect(exercise.warning ?? '').toBe('');
        const prescription = (exercise.prescription || {}) as Record<string, unknown>;
        expect(prescription.weeklyAdjustment).toBeUndefined();
      });
    });
  });

  it('realDataHealthRepairTrainingDecisionUsesCleanedIssueScoresNotRaw', () => {
    const data = loadFixture();
    const pipeline = buildEnginePipeline(data, '2026-05-27', { trainingMode: data.trainingMode });
    const cleanedScores = pipeline.context.screeningProfile?.adaptiveState?.issueScores || {};
    Object.values(cleanedScores).forEach((value) => {
      if (typeof value === 'number') expect(value).toBeLessThanOrEqual(50);
    });
    expect(cleanedScores.scapular_control).not.toBe(1846);
  });

  it('realDataHealthRepairSafeAutoApplyAfterBackup', async () => {
    __test_clearInMemoryBackups();
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.changed).toBe(true);
    expect(adapter.snapshots).toBe(1);
    expect(result.backup).toBeTruthy();
    expect(result.results.some((entry) => entry.status === 'applied')).toBe(true);
  });

  it('realDataHealthRepairBackupFailurePreventsMutationButRuntimeGuardStillProtects', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    adapter.failNext = true;
    const result = await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.changed).toBe(false);
    expect(result.warnings.join(' ')).toContain('backup_failed');
    // Runtime guard still produces a clean view independent of mutation:
    const view = buildCleanAppDataView(data, { now: () => new Date('2026-05-27T00:00:00Z') });
    expect(view.guardDiagnostics.lifecycleResidueSessionIds.length).toBeGreaterThanOrEqual(10);
    expect(view.guardDiagnostics.cappedIssueScoreKeys.length).toBeGreaterThan(0);
  });

  it('realDataHealthRepairNoPopupForSafePath', async () => {
    // The orchestrator API surface intentionally has no confirm hook;
    // run it and assert no callback/prompt argument exists.
    const data = loadFixture();
    const adapter = memoryAdapter();
    await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    // The function signature only takes (input) — no confirm/prompt hook.
    expect(runAutoRepairOrchestrator.length).toBe(1);
  });

  it('realDataHealthRepairLifecycleResidueAutomaticAndIdempotent', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const first = await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    expect(first.changed).toBe(true);
    const second = await runAutoRepairOrchestrator({
      appData: first.appData,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:01Z'),
    });
    expect(second.changed).toBe(false);
  });

  it('realDataHealthRepairRepairedSnapshotHasReceipt', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const logs = result.appData.settings?.dataRepairLogs || [];
    expect(logs.length).toBeGreaterThan(0);
    const ledger = readLedger(result.appData);
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.every((entry) => entry.idempotencyKey.startsWith('idem_') || entry.idempotencyKey.startsWith('backup-failed'))).toBe(true);
  });

  it('realDataHealthRepairSummaryReadable', async () => {
    const data = loadFixture();
    const adapter = memoryAdapter();
    const result = await runAutoRepairOrchestrator({
      appData: data,
      triggeredBy: 'boot',
      backupAdapter: adapter,
      now: () => new Date('2026-05-27T00:00:00Z'),
    });
    const summary = readAutoRepairSummary(result.appData);
    expect(summary).toBeDefined();
    expect(summary?.appliedCount).toBeGreaterThanOrEqual(1);
    expect(summary?.pendingHighRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('realDataHealthRepairAdapterFactoryProducesIsolatedInstance', async () => {
    const adapterA = createAutoRepairBackupAdapter();
    const adapterB = createAutoRepairBackupAdapter();
    expect(adapterA).not.toBe(adapterB);
  });
});
