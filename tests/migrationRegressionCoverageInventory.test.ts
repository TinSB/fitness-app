import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const requiredCoverage = [
  'tests/localStorageToSqliteMigrationDryRun.test.ts',
  'tests/localStorageToSqliteMigrationDryRunBoundary.test.ts',
  'tests/localStorageToSqliteMigrationDryRunDocs.test.ts',
  'tests/localStorageToSqliteMigrationApply.test.ts',
  'tests/localStorageToSqliteMigrationApplyBoundary.test.ts',
  'tests/localStorageToSqliteMigrationApplySafety.test.ts',
  'tests/migrationAcceptance.test.ts',
  'tests/migrationAcceptanceBoundary.test.ts',
  'tests/migrationManualAcceptanceDocs.test.ts',
  'tests/migrationRollbackRecoveryHardening.test.ts',
  'tests/migrationRollbackRecoveryHardeningBoundary.test.ts',
  'tests/migrationRollbackRecoveryHardeningDocs.test.ts',
  'tests/migrationRegressionLock.test.ts',
  'tests/migrationRegressionBoundaryLock.test.ts',
  'tests/migrationRegressionCoverageInventory.test.ts',
  'tests/migrationRegressionDocsParity.test.ts',
];

describe('migration regression coverage inventory', () => {
  it('keeps migration coverage files present', () => {
    for (const file of requiredCoverage) {
      expect(existsSync(resolve(repoRoot(), file)), `${file} should exist`).toBe(true);
    }
  });

  it('records coverage and manual inventory in the regression lock doc', () => {
    const doc = readSource('docs/MIGRATION_REGRESSION_LOCK.md');

    for (const file of requiredCoverage) {
      expect(doc).toContain(file);
    }

    for (const expected of [
      'docs/MIGRATION_ACCEPTANCE_MANUAL.md',
      'dedicated test browser profile',
      'dedicated dev DB',
      'no real personal training data',
      'backup-first apply',
      'SQLite snapshot metadata read',
      'rollback restore',
      'cleanup/env reset',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
