import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import {
  DATA_HEALTH_HEALTH_DATA_STALE_DAYS,
  DATA_HEALTH_TODAY_STATUS_STALE_DAYS,
} from '../src/dataHealth/appDataRepairTypes';

const FIXTURE_PATH = resolve(__dirname, './fixtures/data-health/ironpath-2026-05-27-redacted.json');

const loadFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const repoRoot = resolve(__dirname, '..');
const readSource = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('realDataHealthRepairStaticGuards — static + behavioral guards', () => {
  it('realDataHealthRepairTodayStatusFreshnessThresholdConstantsExist', () => {
    expect(DATA_HEALTH_TODAY_STATUS_STALE_DAYS).toBeGreaterThan(0);
    expect(DATA_HEALTH_HEALTH_DATA_STALE_DAYS).toBeGreaterThan(0);
  });

  it('realDataHealthRepairCleanViewDoesNotMutateRaw', () => {
    const raw = loadFixture();
    const snapshot = JSON.stringify(raw);
    buildCleanAppDataView(raw, { now: () => new Date('2026-05-27T00:00:00Z') });
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it('realDataHealthRepairEnginePipelineImportsCleanAppDataView', () => {
    const source = readSource('src/engines/enginePipeline.ts');
    expect(source.includes('buildCleanAppDataView')).toBe(true);
    expect(source.includes('cleanAppDataView')).toBe(true);
    // Confirm decision context is fed by the cleaned view, not raw:
    expect(/buildTrainingDecisionContext\(\s*cleanAppDataView\.appData/.test(source)).toBe(true);
  });

  it('realDataHealthRepairTrainingDecisionEngineDoesNotReadLegacyAdviceFields', () => {
    const decisionSource = readSource('src/engines/trainingDecisionEngine.ts');
    const readinessSource = readSource('src/engines/readinessEngine.ts');
    const adaptiveSource = readSource('src/engines/adaptiveFeedbackEngine.ts');
    const combined = `${decisionSource}\n${readinessSource}\n${adaptiveSource}`;
    [
      'exercise.suggestion',
      'exercise.warning',
      '.prescription.weeklyAdjustment',
      'session.explanations',
      'deloadDecision.title',
      'deloadDecision.options',
    ].forEach((pattern) => {
      expect(combined.includes(pattern)).toBe(false);
    });
  });

  it('realDataHealthRepairAppBootScheduleOrchestrator', () => {
    const appSource = readSource('src/App.tsx');
    // V2 Cloud Restore Linkage routes boot through the ingress pipeline, which
    // internally dispatches the orchestrator via the same triggeredBy='boot'
    // contract. Either path satisfies the V1 invariant.
    const usesOrchestratorDirect =
      appSource.includes('runAutoRepairOrchestrator') && appSource.includes("triggeredBy: 'boot'");
    const usesIngressPipeline =
      appSource.includes('processIncomingAppData') && /processIncomingAppData\(\s*\{\s*source:\s*'boot'/.test(appSource);
    expect(usesOrchestratorDirect || usesIngressPipeline).toBe(true);
  });

  it('realDataHealthRepairAutoRepairOrchestratorNeverImportsModalOrPrompt', () => {
    const orchestratorSource = readSource('src/dataHealth/autoRepairOrchestrator.ts');
    expect(orchestratorSource.toLowerCase().includes('confirm(')).toBe(false);
    expect(orchestratorSource.toLowerCase().includes('alert(')).toBe(false);
    expect(orchestratorSource.toLowerCase().includes('prompt(')).toBe(false);
    expect(orchestratorSource.toLowerCase().includes('window.confirm')).toBe(false);
  });
});
