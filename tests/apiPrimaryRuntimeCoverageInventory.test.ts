import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, readSource } from './runtimeBoundaryTestHelpers';

const requiredCoverage = [
  'tests/runtimeSourceSelector.test.ts',
  'tests/runtimeSourceSelectorBoundary.test.ts',
  'tests/apiStorageAdapter.test.ts',
  'tests/apiStorageAdapterBoundary.test.ts',
  'tests/apiStorageAdapterErrorHandling.test.ts',
  'tests/bootFromApiSnapshotPrototype.test.ts',
  'tests/bootFromApiSnapshotBoundary.test.ts',
  'tests/bootFromApiSnapshotFailureModes.test.ts',
  'tests/apiWriteThroughRuntimePrototype.test.ts',
  'tests/apiWriteThroughRuntimeBoundary.test.ts',
  'tests/apiWriteThroughRuntimeFailureModes.test.ts',
  'tests/apiWriteThroughRuntimeLocalStorageIntegrity.test.ts',
  'tests/apiPrimaryRuntimeAcceptance.test.ts',
  'tests/apiPrimaryRuntimeAcceptanceBoundary.test.ts',
  'tests/apiPrimaryRuntimeAcceptanceDocs.test.ts',
  'tests/apiPrimaryRuntimeManualAcceptanceDocs.test.ts',
  'tests/apiPrimaryRuntimeManualAcceptanceBoundary.test.ts',
  'tests/apiPrimaryRuntimeManualAcceptanceDocsParity.test.ts',
  'tests/apiPrimaryRuntimeHardening.test.ts',
  'tests/apiPrimaryRuntimeHardeningBoundary.test.ts',
  'tests/apiPrimaryRuntimeHardeningDocs.test.ts',
];

describe('API primary runtime coverage inventory', () => {
  it('keeps all required coverage files present', () => {
    for (const file of requiredCoverage) {
      expect(existsSync(resolve(repoRoot(), file)), `${file} should exist`).toBe(true);
    }
  });

  it('records coverage and manual inventory in the regression lock doc', () => {
    const doc = readSource('docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md');

    for (const file of requiredCoverage) {
      expect(doc).toContain(file);
    }
    for (const expected of [
      'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md',
      'dedicated test browser profile',
      'dedicated dev DB',
      'no real personal training data',
      'all seven accepted write routes',
      'localStorage integrity',
      'cleanup/env reset',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
