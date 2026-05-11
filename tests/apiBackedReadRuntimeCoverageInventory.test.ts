import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API-backed read runtime coverage inventory', () => {
  it('keeps required API-backed read source, tests, and docs present', () => {
    for (const path of [
      'src/devApi/apiBackedReadConfig.ts',
      'src/devApi/apiBackedReadClient.ts',
      'src/devApi/ApiBackedReadDiagnostics.tsx',
      'tests/apiBackedReadConfig.test.ts',
      'tests/apiBackedReadClient.test.ts',
      'tests/apiBackedReadBoundary.test.ts',
      'tests/apiBackedReadDiagnostics.test.tsx',
      'tests/apiBackedReadRuntimeAcceptance.test.ts',
      'tests/apiBackedReadRuntimeLocalStorageIntegrity.test.ts',
      'tests/apiBackedReadRuntimeBoundary.test.ts',
      'tests/apiBackedReadManualAppAcceptanceDocs.test.ts',
      'tests/apiBackedReadManualAppAcceptanceBoundary.test.ts',
      'tests/apiBackedReadManualAppAcceptanceDocsParity.test.ts',
      'tests/apiBackedReadRuntimeRegressionLock.test.ts',
      'tests/apiBackedReadRuntimeRegressionBoundary.test.ts',
      'tests/apiBackedReadRuntimeCoverageInventory.test.ts',
      'tests/apiBackedReadRuntimeDocsParity.test.ts',
      'docs/API_BACKED_READ_RUNTIME_PLAN.md',
      'docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md',
      'docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md',
      'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist`).toBe(true);
    }
  });

  it('keeps acceptance, manual, and regression topics documented', () => {
    const docs = [
      'docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md',
      'docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md',
      'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'API unavailable',
      'malformed response',
      'timeout',
      'snapshot mismatch',
      'readMirror parity',
      'localStorage integrity',
      'Network GET-only',
      'dedicated test browser profile',
      'Coverage Inventory',
      'Future Work Gate',
    ]) {
      expect(docs).toContain(expected);
    }
  });
});
