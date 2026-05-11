import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path four-route regression coverage inventory', () => {
  it('keeps required four-route docs present', () => {
    for (const path of [
      'docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md',
      'docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md',
      'docs/SESSION_START_REGRESSION_LOCK.md',
      'docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md',
      'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'docs/DEV_API_RECOVERY_RESET.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps required four-route tests present', () => {
    for (const path of [
      'tests/writePathFourRouteCheckpoint.test.ts',
      'tests/writePathFourRouteBoundaryLock.test.ts',
      'tests/writePathFourRouteCoverageInventory.test.ts',
      'tests/writePathFourRouteDocsParity.test.ts',
      'tests/writePathFourRouteManualRegressionDocs.test.ts',
      'tests/writePathFourRouteManualRegressionBoundary.test.ts',
      'tests/writePathFourRouteManualRegressionMatrix.test.ts',
      'tests/writePathFourRouteRegressionLock.test.ts',
      'tests/writePathFourRouteRegressionBoundary.test.ts',
      'tests/writePathFourRouteRegressionCoverageInventory.test.ts',
      'tests/sessionStartRegressionLock.test.ts',
      'tests/devApiSessionStartHardeningNoFakeSuccess.test.ts',
      'tests/devApiSessionStartObservabilitySummary.test.ts',
      'tests/readOnlyRuntimeGetOnly.test.ts',
      'tests/runtimeBoundaryNodeOnlyIsolation.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
