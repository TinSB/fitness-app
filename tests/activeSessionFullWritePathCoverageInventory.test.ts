import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('active session full write-path coverage inventory', () => {
  it('keeps required prototype runtime files present', () => {
    for (const path of [
      'src/devApi/devApiSessionStartConfig.ts',
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
      'src/devApi/devApiSessionCompleteConfig.ts',
      'src/devApi/devApiSessionCompleteClient.ts',
      'src/devApi/DevApiSessionCompletePrototype.tsx',
      'src/devApi/devApiSessionDiscardConfig.ts',
      'src/devApi/devApiSessionDiscardClient.ts',
      'src/devApi/DevApiSessionDiscardPrototype.tsx',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps acceptance, hardening, regression, and runbook docs present', () => {
    for (const path of [
      'docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md',
      'docs/SESSION_START_REGRESSION_LOCK.md',
      'docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md',
      'docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md',
      'docs/SESSION_PATCH_PROTOTYPE_ACCEPTANCE_HARDENING.md',
      'docs/SESSION_COMPLETE_ACCEPTANCE_HARDENING.md',
      'docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md',
      'docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md',
      'docs/DEV_API_RECOVERY_RESET.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps required full write-path test coverage present', () => {
    for (const path of [
      'tests/devApiSessionStartClient.test.ts',
      'tests/devApiSessionStartPrototype.test.tsx',
      'tests/devApiSessionStartAcceptanceFlagMatrix.test.ts',
      'tests/devApiSessionStartAcceptanceInteraction.test.ts',
      'tests/devApiSessionStartAcceptanceNoFakeSuccess.test.ts',
      'tests/devApiSessionStartHardeningBoundary.test.ts',
      'tests/devApiSessionStartHardeningConcurrency.test.ts',
      'tests/devApiSessionStartHardeningNoFakeSuccess.test.ts',
      'tests/sessionStartRegressionLock.test.ts',
      'tests/devApiSessionPatchClient.test.ts',
      'tests/devApiSessionPatchAcceptance.test.ts',
      'tests/devApiSessionPatchHardening.test.ts',
      'tests/devApiSessionCompleteClient.test.ts',
      'tests/devApiSessionCompleteAcceptance.test.ts',
      'tests/devApiSessionCompleteHardening.test.ts',
      'tests/devApiSessionDiscardClient.test.ts',
      'tests/devApiSessionDiscardAcceptance.test.ts',
      'tests/devApiSessionDiscardHardening.test.ts',
      'tests/sessionDiscardAcceptanceBoundary.test.ts',
      'tests/activeSessionFullWritePathRegressionLock.test.ts',
      'tests/activeSessionFullWritePathBoundaryLock.test.ts',
      'tests/activeSessionFullWritePathCoverageInventory.test.ts',
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
