import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('Phase 4 exit coverage inventory', () => {
  it('keeps final Phase 4 docs present', () => {
    for (const path of [
      'docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md',
      'docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md',
      'docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md',
      'docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md',
      'docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md',
      'docs/PHASE4_EXIT_REGRESSION_LOCK.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps final Phase 4 coverage present', () => {
    for (const path of [
      'tests/writePathFourRouteRegressionLock.test.ts',
      'tests/phase4SourceOfTruthMigrationReadinessAudit.test.ts',
      'tests/apiBackedRuntimeStrategyPlan.test.ts',
      'tests/phase4FinalDataSafetyAudit.test.ts',
      'tests/phase4ManualFinalAcceptanceDocs.test.ts',
      'tests/phase4ExitRegressionLock.test.ts',
      'tests/phase4ExitBoundaryLock.test.ts',
      'tests/runtimeBoundaryNodeOnlyIsolation.test.ts',
      'tests/readOnlyRuntimeGetOnly.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
