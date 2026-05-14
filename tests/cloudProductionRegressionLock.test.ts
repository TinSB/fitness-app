import { describe, expect, it } from 'vitest';
import { createAuthRuntimeSkeleton } from '../src/cloudProduction/authRuntimeSkeleton';
import { createCloudSyncDisabledSkeleton } from '../src/cloudProduction/cloudSyncDisabledSkeleton';
import { createDeploymentRuntimeSkeleton } from '../src/cloudProduction/deploymentRuntimeSkeleton';
import { createInMemoryAuditCollector } from '../src/cloudProduction/monitoringAuditBoundary';
import { resolveProductionSecretsEnvironmentGuard } from '../src/cloudProduction/productionSecretsEnvironmentGuard';
import { evaluateCutoverFallbackRollback } from '../src/productionCutover/cutoverFallbackRollback';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud production regression lock', () => {
  it('keeps auth cloud deployment and audit boundaries disabled or local-only', () => {
    expect(createAuthRuntimeSkeleton()).toMatchObject({
      status: 'disabled',
      enabled: false,
      secretsExposed: false,
    });
    expect(createCloudSyncDisabledSkeleton()).toMatchObject({
      status: 'disabled',
      enabled: false,
      networkEnabled: false,
      uploadEnabled: false,
      downloadEnabled: false,
      noAutomaticWorker: true,
    });
    expect(createDeploymentRuntimeSkeleton()).toMatchObject({
      status: 'disabled',
      enabled: false,
      canDeploy: false,
      canStartServer: false,
    });
    expect(createInMemoryAuditCollector()).toMatchObject({
      externalTransportEnabled: false,
    });
  });

  it('keeps secrets guard browser-safe and fail-closed', () => {
    expect(resolveProductionSecretsEnvironmentGuard()).toMatchObject({
      ok: false,
      enabled: false,
      browserSafeConfig: {
        enabled: false,
        containsSecrets: false,
      },
      errors: [{ code: 'cloud_runtime_disabled' }],
    });
  });

  it('preserves localStorage and backend-primary candidate safeguards', () => {
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
    expect(resolveSourceOfTruthRuntimeSwitchGuard({ requestedState: 'backend-primary-candidate' })).toMatchObject({
      allowed: false,
      reason: 'explicit_opt_in_required',
    });
    expect(evaluateCutoverFallbackRollback({
      backendAvailable: false,
      backendDataValid: true,
      migrationDryRunSafe: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      fallbackUsed: true,
      rollbackAvailable: true,
      localStorageBackupPreserved: true,
    });
  });

  it('keeps package dependency script and SDK drift absent', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['ajv', 'lucide-react', 'react', 'react-dom']);
    expect(Object.keys(packageJson.devDependencies)).toEqual([
      '@tailwindcss/vite',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      'tailwindcss',
      'typescript',
      'vite',
      'vitest',
    ]);
    expect(Object.keys(packageJson.scripts).filter((script) =>
      /auth|sync|monitor|deploy:backend|production:backend/i.test(script),
    )).toEqual([]);
    for (const dependency of [
      '@clerk/nextjs',
      'next-auth',
      '@supabase/supabase-js',
      'firebase',
      '@auth0/auth0-react',
      '@sentry/react',
      'dd-trace',
      'express',
      'fastify',
      'prisma',
    ]) {
      expect(packageJson.dependencies).not.toHaveProperty(dependency);
      expect(packageJson.devDependencies).not.toHaveProperty(dependency);
    }
  });

  it('documents Phase 10 locked boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_PRODUCTION_REGRESSION_LOCK.md');

    for (const expected of [
      'Auth skeleton exists and is disabled by default.',
      'Cloud sync skeleton exists and is disabled by default.',
      'Deployment runtime skeleton exists and is disabled by default.',
      'Monitoring/audit boundary has no external upload.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend-primary candidate remains explicit opt-in and reversible.',
      'Accepted browser mutation routes remain exactly seven.',
      'No normalized tables are added.',
      'Real personal data fixtures remain excluded.',
      'Recommended next task: Task 10.14 Phase 10 Completion Archive V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
