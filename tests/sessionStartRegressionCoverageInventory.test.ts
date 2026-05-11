import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('session start regression coverage inventory', () => {
  it('keeps required Session Start runtime files present', () => {
    for (const path of [
      'src/devApi/devApiSessionStartConfig.ts',
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps Session Start coverage present and runnable under the configured test glob', () => {
    for (const path of [
      'tests/devApiSessionStartConfig.test.ts',
      'tests/devApiSessionStartClient.test.ts',
      'tests/devApiSessionStartPrototype.test.tsx',
      'tests/devApiSessionStartBoundary.test.ts',
      'tests/devApiSessionStartSemantics.test.ts',
      'tests/devApiSessionStartServerParity.test.ts',
      'tests/devApiSessionStartAcceptanceBoundary.test.ts',
      'tests/devApiSessionStartAcceptanceFlagMatrix.test.ts',
      'tests/devApiSessionStartAcceptanceInteraction.test.ts',
      'tests/devApiSessionStartAcceptanceNoFakeSuccess.test.ts',
      'tests/sessionStartPrototypeAcceptanceDocs.test.ts',
      'tests/sessionStartPrototypeAcceptanceBoundary.test.ts',
      'tests/sessionStartManualAppAcceptanceBoundary.test.ts',
      'tests/sessionStartManualAppAcceptanceDocs.test.ts',
      'tests/sessionStartManualAppAcceptanceDocsParity.test.ts',
      'tests/devApiSessionStartHardeningBoundary.test.ts',
      'tests/devApiSessionStartHardeningConcurrency.test.ts',
      'tests/devApiSessionStartHardeningDocsParity.test.ts',
      'tests/devApiSessionStartHardeningNoFakeSuccess.test.ts',
      'tests/devApiSessionStartObservabilityBoundary.test.ts',
      'tests/devApiSessionStartObservabilityDocsParity.test.ts',
      'tests/devApiSessionStartObservabilityFailureMapping.test.ts',
      'tests/devApiSessionStartObservabilitySummary.test.ts',
      'tests/sessionStartRegressionLock.test.ts',
      'tests/sessionStartRegressionBoundary.test.ts',
      'tests/sessionStartRegressionCoverageInventory.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps required Session Start docs and runbooks present', () => {
    for (const path of [
      'docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md',
      'docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md',
      'docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md',
      'docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md',
      'docs/SESSION_START_PROTOTYPE_HARDENING.md',
      'docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/SESSION_START_REGRESSION_LOCK.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'docs/DEV_API_RECOVERY_RESET.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
