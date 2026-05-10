import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path two-route coverage inventory', () => {
  it('keeps required DataHealth dismiss files and docs present', () => {
    for (const path of [
      'src/devApi/devApiDataHealthDismissConfig.ts',
      'src/devApi/devApiDataHealthDismissClient.ts',
      'src/devApi/DevApiDataHealthDismissPrototype.tsx',
      'tests/devApiDataHealthDismissConfig.test.ts',
      'tests/devApiDataHealthDismissClient.test.ts',
      'tests/devApiDataHealthDismissPrototype.test.ts',
      'tests/devApiDataHealthDismissAcceptanceBoundary.test.ts',
      'tests/devApiDataHealthDismissAcceptanceSourceOfTruth.test.ts',
      'tests/devApiDataHealthDismissHardeningNoFakeSuccess.test.ts',
      'tests/devApiDataHealthDismissObservabilityBoundary.test.ts',
      'tests/dataHealthDismissRegressionRouteLock.test.ts',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps required History data-flag files and docs present', () => {
    for (const path of [
      'src/devApi/devApiHistoryDataFlagConfig.ts',
      'src/devApi/devApiHistoryDataFlagClient.ts',
      'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
      'tests/devApiHistoryDataFlagConfig.test.ts',
      'tests/devApiHistoryDataFlagClient.test.ts',
      'tests/devApiHistoryDataFlagPrototype.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceBoundary.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceSourceOfTruth.test.ts',
      'tests/devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts',
      'tests/devApiHistoryDataFlagHardeningBoundary.test.ts',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps two-route, read-only, runtime, and server coverage present', () => {
    for (const path of [
      'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
      'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md',
      'tests/writePathTwoRouteCheckpoint.test.ts',
      'tests/writePathTwoRouteBoundaryLock.test.ts',
      'tests/writePathTwoRouteManualRegressionDocs.test.ts',
      'tests/writePathTwoRouteManualRegressionBoundary.test.ts',
      'tests/writePathTwoRouteRegressionLock.test.ts',
      'tests/writePathTwoRouteAllowlistLock.test.ts',
      'tests/readOnlyRuntimeGetOnly.test.ts',
      'tests/readOnlyRuntimeBoundary.test.ts',
      'tests/readOnlyRuntimeLocalStorageIntegrity.test.ts',
      'tests/runtimeBoundaryNodeOnlyIsolation.test.ts',
      'tests/runtimeBoundaryServerHttpContract.test.ts',
      'tests/runtimeBoundaryRepositoryContract.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
