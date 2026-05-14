import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 10 browser secret isolation lock', () => {
  it('keeps cloudProduction modules free of Node-only and external service imports', () => {
    const sources = [
      'src/cloudProduction/authRuntimeSkeleton.ts',
      'src/cloudProduction/accountScopedAppData.ts',
      'src/cloudProduction/cloudSyncDisabledSkeleton.ts',
      'src/cloudProduction/productionSecretsEnvironmentGuard.ts',
      'src/cloudProduction/deploymentRuntimeSkeleton.ts',
      'src/cloudProduction/monitoringAuditBoundary.ts',
    ].map(readSource).join('\n');

    for (const forbidden of [
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      '@clerk',
      'next-auth',
      '@supabase',
      'firebase',
      'auth0',
      'Sentry',
      'Datadog',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      'localStorage.setItem',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('keeps browser-facing API index free of cloud production skeleton exports', () => {
    const browserApiIndex = readSource('apps/api/src/index.ts');

    for (const forbidden of [
      'authRuntimeSkeleton',
      'cloudSyncDisabledSkeleton',
      'deploymentRuntimeSkeleton',
      'monitoringAuditBoundary',
      'productionSecretsEnvironmentGuard',
    ]) {
      expect(browserApiIndex).not.toContain(forbidden);
    }
  });

  it('documents secret and dist isolation expectations', () => {
    const doc = readSource('docs/CLOUD_PRODUCTION_REGRESSION_LOCK.md');

    for (const expected of [
      'No secret appears in browser-safe config or production dist.',
      'No analytics/telemetry SDK dependency exists.',
      'devApiRunner is not production backend.',
      'node:sqlite snapshot repository is not production multi-user database.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
