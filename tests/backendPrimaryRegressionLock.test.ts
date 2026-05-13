import { describe, expect, it } from 'vitest';
import { createBackendPrimaryRuntimeHost } from '../apps/api/src/node/backendPrimaryRuntimeHost';
import { createInMemoryBackendAppDataRepositoryCandidate } from '../apps/api/src/node/backendAppDataRepositoryCandidate';
import { runBackendPrimaryReadCandidate } from '../src/productionCutover/backendPrimaryReadCandidate';
import { evaluateCutoverFallbackRollback } from '../src/productionCutover/cutoverFallbackRollback';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { runBackendPrimaryMutationCandidate } from '../src/productionCutover/backendPrimaryMutationCandidate';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('backend-primary regression lock', () => {
  it('keeps localStorage roles and backend-primary explicit opt-in locked', async () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      localStorageFallbackAvailable: true,
      productionReady: false,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard()).toMatchObject({
      state: 'localStorage-primary',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidateEnabled: false,
      localStorageFallbackAvailable: true,
      localStorageMigrationSourceAvailable: true,
      localStorageEmergencyBackupAvailable: true,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
    })).toMatchObject({
      state: 'localStorage-primary',
      allowed: false,
      reason: 'explicit_opt_in_required',
    });
    expect(createBackendPrimaryRuntimeHost()).toMatchObject({ enabled: false, sourceOfTruth: false });
    expect(createInMemoryBackendAppDataRepositoryCandidate()).toMatchObject({ enabled: false, sourceOfTruth: false });
    await expect(runBackendPrimaryReadCandidate({ surface: 'history' })).resolves.toMatchObject({ status: 'disabled' });
    await expect(runBackendPrimaryMutationCandidate({
      request: { routeId: 'historyEdit', payload: { synthetic: true } },
    })).resolves.toMatchObject({ status: 'disabled' });
  });

  it('keeps fallback rollback emergency restore boundaries available', () => {
    expect(evaluateCutoverFallbackRollback({
      migrationDryRunSafe: true,
      backendAvailable: false,
      backendDataValid: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      sourceOfTruthState: 'fallback-localStorage',
      fallbackUsed: true,
      rollbackAvailable: true,
      localStorageBackupPreserved: true,
    });
    expect(evaluateCutoverFallbackRollback({
      emergencyRestoreRequested: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      sourceOfTruthState: 'emergency-localStorage',
      emergencyRestoreAvailable: true,
      rollbackPerformed: true,
    });
  });

  it('documents blocked production and data boundaries', () => {
    const doc = readSource('docs/BACKEND_PRIMARY_REGRESSION_LOCK.md');

    for (const expected of [
      'no auth/user accounts/cloud sync/deployment/monitoring runtime',
      'no SaaS/multi-user runtime',
      'no normalized tables',
      'no destructive migration',
      'no real personal data fixtures',
      'no package dependency/script/lockfile drift',
      'api-primary-dev remains dev/local only and not production-ready',
      'devApiRunner is not production backend',
      'Recommended next task: Task 9.12 Phase 9 Completion Archive V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
