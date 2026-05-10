import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path three-route coverage inventory', () => {
  it('keeps required prototype runtime files present', () => {
    for (const path of [
      'src/devApi/devApiDataHealthDismissConfig.ts',
      'src/devApi/devApiDataHealthDismissClient.ts',
      'src/devApi/DevApiDataHealthDismissPrototype.tsx',
      'src/devApi/devApiHistoryDataFlagConfig.ts',
      'src/devApi/devApiHistoryDataFlagClient.ts',
      'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
      'src/devApi/devApiHistorySetEditConfig.ts',
      'src/devApi/devApiHistorySetEditClient.ts',
      'src/devApi/DevApiHistorySetEditExperiment.tsx',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps checkpoint, manual, lock, and runbook docs present', () => {
    for (const path of [
      'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
      'docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md',
      'docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md',
      'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md',
      'docs/DEV_API_RECOVERY_RESET.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps required three-route regression coverage present', () => {
    for (const path of [
      'tests/devApiDataHealthDismissClient.test.ts',
      'tests/devApiHistoryDataFlagClient.test.ts',
      'tests/devApiLimitedHistoryEditClient.test.ts',
      'tests/dataHealthDismissRegressionRouteLock.test.ts',
      'tests/devApiHistoryDataFlagHardeningBoundary.test.ts',
      'tests/limitedHistoryEditRegressionBoundary.test.ts',
      'tests/limitedHistoryEditRegressionLock.test.ts',
      'tests/writePathThreeRouteCheckpoint.test.ts',
      'tests/writePathThreeRouteBoundaryLock.test.ts',
      'tests/writePathThreeRouteCoverageInventory.test.ts',
      'tests/readOnlyRuntimeGetOnly.test.ts',
      'tests/readOnlyRuntimeBoundary.test.ts',
      'tests/runtimeBoundaryNodeOnlyIsolation.test.ts',
      'tests/runtimeBoundaryServerHttpContract.test.ts',
      'tests/runtimeBoundaryRepositoryContract.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
