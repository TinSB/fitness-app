import { describe, expect, it } from 'vitest';
import { createAuthRuntimeSkeleton } from '../src/cloudProduction/authRuntimeSkeleton';
import { createCloudSyncDisabledSkeleton } from '../src/cloudProduction/cloudSyncDisabledSkeleton';
import { createDeploymentRuntimeSkeleton } from '../src/cloudProduction/deploymentRuntimeSkeleton';
import { createInMemoryAuditCollector } from '../src/cloudProduction/monitoringAuditBoundary';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 10 completion boundary still blocked', () => {
  it('keeps localStorage default and backend-primary candidate explicit opt-in', () => {
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
  });

  it('keeps cloud production skeletons disabled and local-only', () => {
    expect(createAuthRuntimeSkeleton()).toMatchObject({ status: 'disabled', enabled: false });
    expect(createCloudSyncDisabledSkeleton()).toMatchObject({
      status: 'disabled',
      enabled: false,
      uploadEnabled: false,
      downloadEnabled: false,
    });
    expect(createDeploymentRuntimeSkeleton()).toMatchObject({
      status: 'disabled',
      enabled: false,
      canDeploy: false,
    });
    expect(createInMemoryAuditCollector()).toMatchObject({
      externalTransportEnabled: false,
    });
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('documents final blocked production capabilities', () => {
    const doc = readSource('docs/PHASE10_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'No real auth provider integration exists.',
      'No real login/signup/user accounts runtime exists.',
      'No real cloud sync exists.',
      'No production deployment runtime exists.',
      'No external monitoring upload exists.',
      'No SaaS/multi-user runtime exists.',
      'No normalized tables were added.',
      'No destructive migration was added.',
      'Real personal training data remains excluded',
      'No package dependency, package script, or lockfile change was introduced by Phase 10.',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
