import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('limited history edit regression coverage inventory', () => {
  it('keeps required Limited History Edit runtime files present', () => {
    for (const path of [
      'src/devApi/devApiHistorySetEditConfig.ts',
      'src/devApi/devApiHistorySetEditClient.ts',
      'src/devApi/DevApiHistorySetEditExperiment.tsx',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps Limited History Edit coverage present and runnable under the configured test glob', () => {
    for (const path of [
      'tests/devApiLimitedHistoryEditConfig.test.ts',
      'tests/devApiLimitedHistoryEditClient.test.ts',
      'tests/devApiLimitedHistoryEditPrototype.test.ts',
      'tests/devApiLimitedHistoryEditBoundary.test.ts',
      'tests/devApiLimitedHistoryEditSemantics.test.ts',
      'tests/devApiLimitedHistoryEditServerParity.test.ts',
      'tests/devApiLimitedHistoryEditAcceptanceBoundary.test.ts',
      'tests/devApiLimitedHistoryEditAcceptanceDocs.test.ts',
      'tests/devApiLimitedHistoryEditAcceptanceFlagMatrix.test.ts',
      'tests/devApiLimitedHistoryEditAcceptanceInteraction.test.ts',
      'tests/devApiLimitedHistoryEditAcceptanceNoFakeSuccess.test.ts',
      'tests/limitedHistoryEditManualAppAcceptanceBoundary.test.ts',
      'tests/limitedHistoryEditManualAppAcceptanceDocs.test.ts',
      'tests/limitedHistoryEditManualAppAcceptanceDocsParity.test.ts',
      'tests/devApiLimitedHistoryEditHardeningBoundary.test.ts',
      'tests/devApiLimitedHistoryEditHardeningConfirmation.test.ts',
      'tests/devApiLimitedHistoryEditHardeningDocsParity.test.ts',
      'tests/devApiLimitedHistoryEditHardeningNoFakeSuccess.test.ts',
      'tests/devApiLimitedHistoryEditHardeningSemantics.test.ts',
      'tests/devApiLimitedHistoryEditObservabilityBoundary.test.ts',
      'tests/devApiLimitedHistoryEditObservabilityDocsParity.test.ts',
      'tests/devApiLimitedHistoryEditObservabilityFailureMapping.test.ts',
      'tests/devApiLimitedHistoryEditObservabilitySummary.test.ts',
      'tests/limitedHistoryEditRegressionLock.test.ts',
      'tests/limitedHistoryEditRegressionCoverageInventory.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }

    for (const stalePath of [
      'tests/devApiLimitedHistoryEditPrototype.test.tsx',
      'tests/devApiLimitedHistoryEditAcceptanceInteraction.test.tsx',
      'tests/devApiLimitedHistoryEditHardeningConfirmation.test.tsx',
    ]) {
      expect(exists(stalePath), `${stalePath} should stay out of the inactive .test.tsx glob`).toBe(false);
    }
  });

  it('keeps required Limited History Edit docs and runbooks present', () => {
    for (const path of [
      'docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md',
      'docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md',
      'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md',
      'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md',
      'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md',
      'docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'docs/DEV_API_RECOVERY_RESET.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });
});
