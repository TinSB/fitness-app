import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');
const readSource = (relative: string): string => readFileSync(resolve(repoRoot, relative), 'utf8');

describe('dataHealthCloudRestoreLinkageStaticGuards', () => {
  it('dataHealthCloudRestoreLinkageStaticAppBootUsesIngressPipeline', () => {
    const source = readSource('src/App.tsx');
    expect(source.includes('processIncomingAppData')).toBe(true);
    expect(/processIncomingAppData\(\s*\{\s*source:\s*'boot'/.test(source)).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticImportRestoreUsesIngress', () => {
    const source = readSource('src/App.tsx');
    expect(source.includes("'backup-restore'")).toBe(true);
    expect(source.includes("'import-restore'")).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticPostSessionUsesIngress', () => {
    const source = readSource('src/App.tsx');
    expect(source.includes("'post-session-complete'")).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticSessionStartFeedsCleanView', () => {
    const source = readSource('src/App.tsx');
    // The startSession-time TrainingDecision must go through CleanAppDataView,
    // not raw workingData.
    expect(source.includes('buildCleanAppDataView(workingData)')).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticEnginePipelineCleanViewInvariant', () => {
    const source = readSource('src/engines/enginePipeline.ts');
    expect(source.includes('buildCleanAppDataView')).toBe(true);
    expect(/buildTrainingDecisionContext\(\s*cleanAppDataView\.appData/.test(source)).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticPipelineNoModalImports', () => {
    const source = readSource('src/dataHealth/appDataIngressPipeline.ts');
    expect(source.toLowerCase().includes('confirm(')).toBe(false);
    expect(source.toLowerCase().includes('alert(')).toBe(false);
    expect(source.toLowerCase().includes('prompt(')).toBe(false);
    expect(source.toLowerCase().includes('window.confirm')).toBe(false);
    expect(source.includes("from './confirm")).toBe(false);
    expect(source.includes("'../ui/useConfirmDialog'")).toBe(false);
  });

  it('dataHealthCloudRestoreLinkageStaticOrchestratorNoCloudWrite', () => {
    const orchestrator = readSource('src/dataHealth/autoRepairOrchestrator.ts');
    const pipeline = readSource('src/dataHealth/appDataIngressPipeline.ts');
    [orchestrator, pipeline].forEach((src) => {
      expect(src.includes('cloudPushCandidate')).toBe(false);
      expect(src.includes('cloudWriteShadow')).toBe(false);
      expect(src.includes('firstUploadExplicitApply')).toBe(false);
      expect(src.includes('writeCloudAppDataCandidate')).toBe(false);
    });
  });

  it('dataHealthCloudRestoreLinkageStaticUploadEligibilityExists', () => {
    const eligibility = readSource('src/dataHealth/uploadEligibility.ts');
    expect(eligibility.includes('evaluateCloudUploadEligibility')).toBe(true);
    expect(eligibility.includes("'data_health_backup_failed'")).toBe(true);
    expect(eligibility.includes("'data_health_pending_safe_auto_repair'")).toBe(true);
  });

  it('dataHealthCloudRestoreLinkageStaticPipelineDoesNotDeleteHistory', () => {
    const pipeline = readSource('src/dataHealth/appDataIngressPipeline.ts');
    expect(pipeline.includes('history = []')).toBe(false);
    expect(pipeline.includes('history.length = 0')).toBe(false);
    expect(pipeline.includes('delete appData.history')).toBe(false);
    expect(pipeline.includes('localStorage.clear')).toBe(false);
  });

  it('dataHealthCloudRestoreLinkageStaticAllIngressSourcesCovered', () => {
    const pipeline = readSource('src/dataHealth/appDataIngressPipeline.ts');
    [
      "'boot'",
      "'localStorage-load'",
      "'import-restore'",
      "'backup-restore'",
      "'cloud-restore'",
      "'cloud-pull'",
      "'read-mirror'",
      "'cloud-parity'",
      "'account-switch'",
      "'post-session-complete'",
      "'pre-training-decision'",
      "'pre-cloud-upload'",
      "'export'",
    ].forEach((source) => {
      expect(pipeline.includes(source)).toBe(true);
    });
  });

  it('dataHealthCloudRestoreLinkageStaticBoundaryHelperAllowsLinkageDiff', () => {
    const boundary = readSource('tests/runtimeBoundaryTestHelpers.ts');
    expect(boundary.includes('isDataHealthRepairAutomationDiff') ||
      boundary.includes('isDataHealthCloudRestoreLinkageDiff')).toBe(true);
  });
});
