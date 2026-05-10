import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path two-route regression matrix', () => {
  it('keeps DataHealth dismiss regression coverage present', () => {
    for (const path of [
      'src/devApi/devApiDataHealthDismissConfig.ts',
      'src/devApi/devApiDataHealthDismissClient.ts',
      'src/devApi/DevApiDataHealthDismissPrototype.tsx',
      'tests/devApiDataHealthDismissConfig.test.ts',
      'tests/devApiDataHealthDismissClient.test.ts',
      'tests/devApiDataHealthDismissPrototype.test.ts',
      'tests/devApiDataHealthDismissAcceptanceFlagMatrix.test.ts',
      'tests/devApiDataHealthDismissAcceptanceInteraction.test.ts',
      'tests/devApiDataHealthDismissAcceptanceFailures.test.ts',
      'tests/devApiDataHealthDismissAcceptanceBoundary.test.ts',
      'tests/devApiDataHealthDismissAcceptanceSourceOfTruth.test.ts',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'tests/devApiDataHealthDismissHardeningNoFakeSuccess.test.ts',
      'tests/devApiDataHealthDismissHardeningFailureStates.test.ts',
      'tests/devApiDataHealthDismissHardeningConcurrency.test.ts',
      'tests/devApiDataHealthDismissHardeningConfirmation.test.ts',
      'tests/devApiDataHealthDismissHardeningBoundary.test.ts',
      'tests/devApiDataHealthDismissObservabilitySummary.test.ts',
      'tests/devApiDataHealthDismissRecoveryNotes.test.ts',
      'tests/dataHealthDismissRegressionRouteLock.test.ts',
      'tests/dataHealthDismissRegressionBoundary.test.ts',
      'tests/dataHealthDismissRegressionSuccessContract.test.ts',
      'tests/dataHealthDismissRegressionFailureMapping.test.ts',
      'tests/dataHealthDismissRegressionObservabilityDocs.test.ts',
      'tests/dataHealthDismissRegressionUxControls.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps History data-flag regression coverage present', () => {
    for (const path of [
      'src/devApi/devApiHistoryDataFlagConfig.ts',
      'src/devApi/devApiHistoryDataFlagClient.ts',
      'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
      'tests/devApiHistoryDataFlagConfig.test.ts',
      'tests/devApiHistoryDataFlagClient.test.ts',
      'tests/devApiHistoryDataFlagPrototype.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceFlagMatrix.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceInteraction.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceNoFakeSuccess.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceFailureStates.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceSourceOfTruth.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceSemantics.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceBoundary.test.ts',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'tests/devApiHistoryDataFlagManualAcceptanceDocs.test.ts',
      'tests/devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts',
      'tests/devApiHistoryDataFlagHardeningFailureStates.test.ts',
      'tests/devApiHistoryDataFlagHardeningConcurrency.test.tsx',
      'tests/devApiHistoryDataFlagHardeningConcurrencyRuntime.test.ts',
      'tests/devApiHistoryDataFlagHardeningConfirmation.test.tsx',
      'tests/devApiHistoryDataFlagHardeningConfirmationRuntime.test.ts',
      'tests/devApiHistoryDataFlagHardeningSemantics.test.ts',
      'tests/devApiHistoryDataFlagHardeningBoundary.test.ts',
      'tests/devApiHistoryDataFlagHardeningDocsParity.test.ts',
      'tests/devApiHistoryDataFlagServerParity.test.ts',
      'tests/devApiHistoryDataFlagSemantics.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps read-only diagnostics and runtime boundary coverage present', () => {
    for (const path of [
      'tests/readOnlyRuntimeFlagOffParity.test.ts',
      'tests/readOnlyRuntimeGetOnly.test.ts',
      'tests/readOnlyRuntimeApiUnavailableFallback.test.ts',
      'tests/readOnlyRuntimeMismatchDiagnostics.test.ts',
      'tests/readOnlyRuntimeLocalStorageIntegrity.test.ts',
      'tests/readOnlyRuntimeDiagnosticsUi.test.ts',
      'tests/readOnlyRuntimeBoundary.test.ts',
      'tests/readOnlyDiagnosticsStatusModel.test.ts',
      'tests/readOnlyDiagnosticsMisconfiguration.test.ts',
      'tests/readOnlyDiagnosticsEndpointSummary.test.ts',
      'tests/readOnlyDiagnosticsDocsParity.test.ts',
      'tests/mutationIntegrationReadinessAudit.test.ts',
      'tests/mutationIntegrationBoundaryStillBlocked.test.ts',
      'tests/writePathSourceOfTruthOfflineStrategy.test.ts',
      'tests/writePathMutationBoundaryStillBlocked.test.ts',
      'tests/mutationUxConfirmationRollbackPlan.test.ts',
      'tests/mutationUxBoundaryStillBlocked.test.ts',
      'tests/runtimeBoundaryNodeOnlyIsolation.test.ts',
      'tests/runtimeBoundaryMutationContract.test.ts',
      'tests/runtimeBoundaryRepositoryContract.test.ts',
      'tests/runtimeBoundaryPersistenceCompatibility.test.ts',
      'tests/runtimeBoundaryDataSemanticsRegression.test.ts',
      'tests/runtimeBoundaryServerHttpContract.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
