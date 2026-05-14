import { describe, expect, it } from 'vitest';
import { resolveProductionDeploymentConfigGuard } from '../src/cloudProduction/productionDeploymentConfigGuard';
import { resolveFrontendProductionEnvironmentSeparation } from '../src/cloudProduction/frontendProductionEnvironmentSeparation';
import { createMonitoringAuditAdapterCandidate } from '../src/cloudProduction/monitoringAuditAdapterCandidate';
import { createProductionDiagnosticsIncidentSnapshot } from '../src/cloudProduction/productionDiagnosticsIncidentSnapshot';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 browser secret monitoring isolation lock', () => {
  it('keeps service role and secret-like values out of browser-safe deployment config', () => {
    const result = resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      supabaseProjectUrl: 'https://project.supabase.co',
      supabaseProjectClassification: 'production',
      serviceRoleKeyPresentInBrowserConfig: true,
      browserConfig: { serviceRoleValue: 'synthetic-secret-value' },
    });

    expect(result).toMatchObject({
      ok: false,
      browserSafeConfig: {
        serviceRoleExposed: false,
        containsSecrets: false,
        deploymentStarted: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('keeps frontend environment separation from exposing secrets or enabling cloud candidates automatically', () => {
    const result = resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      apiBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectClass: 'production-candidate',
      cloudCandidateRequested: true,
      browserConfig: { tokenValue: 'synthetic-token' },
    });

    expect(result).toMatchObject({
      ok: false,
      cloudCandidateAutoEnabled: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      releaseChannelInfo: {
        containsSecrets: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-token');
  });

  it('keeps monitoring adapter local and diagnostics redacted', () => {
    const adapter = createMonitoringAuditAdapterCandidate({ enabled: true });
    adapter.record({
      type: 'diagnostic_snapshot_created',
      metadata: {
        serviceRoleValue: 'synthetic-service-role',
        safeStatus: 'redacted',
      },
    });

    const snapshot = createProductionDiagnosticsIncidentSnapshot({
      environment: 'production-candidate',
      releaseChannel: 'production-candidate',
      runtimeSourceState: 'localStorage-primary',
      unsafeDetails: {
        fullAppData: { synthetic: true },
        fullLocalStorage: 'synthetic-local-storage',
        personalNotes: 'synthetic-note',
      },
    });

    expect(adapter.snapshot()).toMatchObject({
      externalTransport: 'none',
      noExternalUpload: true,
      redacted: true,
    });
    expect(snapshot).toMatchObject({
      redacted: true,
      noExternalUpload: true,
      fullUserDataIncluded: false,
      secretsIncluded: false,
    });
    expect(JSON.stringify(adapter.snapshot())).not.toContain('synthetic-service-role');
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-local-storage');
  });

  it('keeps browser-safe Phase 13 modules free of network and provider upload hooks', () => {
    const sources = [
      'src/cloudProduction/productionDeploymentConfigGuard.ts',
      'src/cloudProduction/frontendProductionEnvironmentSeparation.ts',
      'src/cloudProduction/monitoringAuditAdapterCandidate.ts',
      'src/cloudProduction/productionDiagnosticsIncidentSnapshot.ts',
      'src/cloudProduction/releaseRollbackKillSwitch.ts',
    ].map(readSource).join('\n');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      '@sentry',
      'telemetryUpload',
      'analyticsUpload',
      'fullAppDataSnapshotUpload',
      'process.env',
      'localStorage.setItem',
      'localStorage.removeItem',
      'localStorage.clear',
      'node:http',
      'node:sqlite',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'backgroundWorker',
      'automaticUpload',
      'automaticDownload',
      'polling',
      'timer',
      'automaticWorker',
      'autoDeploy',
      'deployProductionNow',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });
});
