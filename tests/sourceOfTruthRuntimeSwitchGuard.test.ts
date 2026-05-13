import { describe, expect, it } from 'vitest';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('source-of-truth runtime switch guard', () => {
  it('defaults to localStorage-primary and preserves all localStorage safety roles', () => {
    expect(resolveSourceOfTruthRuntimeSwitchGuard()).toEqual({
      state: 'localStorage-primary',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidateEnabled: false,
      localStorageFallbackAvailable: true,
      localStorageMigrationSourceAvailable: true,
      localStorageEmergencyBackupAvailable: true,
      localStorageDeleted: false,
      allowed: true,
      reason: 'default_localStorage_primary',
    });
  });

  it('supports disabled, backend-read candidate, and backend-primary candidate through explicit opt-in', () => {
    expect(resolveSourceOfTruthRuntimeSwitchGuard({ requestedState: 'disabled' })).toMatchObject({
      state: 'disabled',
      sourceOfTruth: 'localStorage',
      localStorageDeleted: false,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-read-candidate',
      explicitOptIn: true,
      backendAvailable: true,
    })).toMatchObject({
      state: 'backend-read-candidate',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidateEnabled: false,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
      explicitOptIn: true,
      backendAvailable: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      state: 'backend-primary-candidate',
      sourceOfTruth: 'backend-primary-candidate',
      backendPrimaryCandidateEnabled: true,
      localStorageFallbackAvailable: true,
      localStorageEmergencyBackupAvailable: true,
      localStorageDeleted: false,
    });
  });

  it('fails closed without opt-in, with dev API config, missing backend, or missing backup', () => {
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
    })).toMatchObject({
      state: 'localStorage-primary',
      allowed: false,
      reason: 'explicit_opt_in_required',
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
      explicitOptIn: true,
      backendAvailable: true,
      runtimeSource: 'api-primary-dev',
      localStorageBackupAvailable: true,
    })).toMatchObject({
      state: 'localStorage-primary',
      allowed: false,
      reason: 'dev_api_rejected_for_production_candidate',
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
      explicitOptIn: true,
      backendAvailable: false,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      state: 'fallback-localStorage',
      allowed: false,
      reason: 'backend_unavailable',
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
      explicitOptIn: true,
      backendAvailable: true,
      localStorageBackupAvailable: false,
    })).toMatchObject({
      state: 'fallback-localStorage',
      reason: 'localStorage_backup_required',
    });
  });

  it('keeps fallback and emergency localStorage transitions reachable', () => {
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-read-candidate',
      explicitOptIn: true,
      backendAvailable: false,
    })).toMatchObject({
      state: 'fallback-localStorage',
      sourceOfTruth: 'localStorage',
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({ emergencyRestoreRequested: true })).toMatchObject({
      state: 'emergency-localStorage',
      sourceOfTruth: 'localStorage',
      localStorageDeleted: false,
    });
  });

  it('keeps source free of Node-only imports and App integration', () => {
    const source = readSource('src/productionCutover/sourceOfTruthRuntimeSwitchGuard.ts');
    const app = readSource('src/App.tsx');

    for (const forbidden of ['node:http', 'node:sqlite', 'apps/api/src/node']) {
      expect(source).not.toContain(forbidden);
    }
    expect(app).not.toContain('sourceOfTruthRuntimeSwitchGuard');
  });

  it('documents Task 9.7 boundaries and next task', () => {
    const doc = readSource('docs/FRONTEND_SOURCE_OF_TRUTH_RUNTIME_SWITCH_GUARD.md');

    for (const expected of [
      'Task 9.7 Frontend Source-of-Truth Runtime Switch Guard V1',
      'Default state is `localStorage-primary`.',
      'Backend-primary candidate requires explicit opt-in.',
      'Dev/local API configuration cannot enable production backend-primary candidate mode.',
      'Fallback-localStorage and emergency-localStorage remain reachable.',
      'Recommended next task: Task 9.8 Cutover Fallback, Rollback & Emergency Restore V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
