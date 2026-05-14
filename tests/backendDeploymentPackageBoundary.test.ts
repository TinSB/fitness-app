import { describe, expect, it } from 'vitest';
import {
  createBackendDeploymentPackageBoundary,
  createBackendDeploymentPackageCapabilities,
  resolveBackendDeploymentPackageState,
} from '../apps/api/src/node/backendDeploymentPackageBoundary';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const validConfig = {
  ok: true,
  state: 'valid' as const,
  errors: [],
};

describe('backend deployment package boundary', () => {
  it('is disabled by default and does not start deployment', () => {
    expect(createBackendDeploymentPackageBoundary()).toEqual({
      kind: 'backend-deployment-package-boundary',
      state: 'deployment_disabled',
      enabled: false,
      nodeOnly: true,
      configValidation: {
        ok: false,
        state: 'missing',
        errors: ['config_missing'],
      },
      capabilities: {
        backendEntryCapability: 'unavailable',
        startMode: 'disabled',
        healthReadiness: 'unavailable',
        capabilitiesReadiness: 'unavailable',
        readCandidateReadiness: 'unavailable',
        writeCandidateReadiness: 'unavailable',
        deploymentState: 'deployment_disabled',
        deploymentStarted: false,
        autoStart: false,
        autoListen: false,
        bindsNetworkPort: false,
        sourceOfTruthChanged: false,
        defaultCloudSync: false,
        apiPrimaryDevPromoted: false,
        devRuntimeHostedAsProduction: false,
        sqliteSnapshotPromoted: false,
        localStorageRole: 'default_fallback_migration_emergency',
      },
    });
  });

  it('returns stable states for missing invalid unsupported and not-started candidates', () => {
    expect(resolveBackendDeploymentPackageState({ enabled: true })).toBe('not_configured');
    expect(resolveBackendDeploymentPackageState({
      enabled: true,
      configValidation: { ok: false, state: 'invalid', errors: ['backend_url_unsafe'] },
    })).toBe('config_invalid');
    expect(resolveBackendDeploymentPackageState({
      enabled: true,
      unsupportedRuntime: true,
      configValidation: validConfig,
    })).toBe('unsupported');
    expect(resolveBackendDeploymentPackageState({
      enabled: true,
      backendEntryAvailable: true,
      configValidation: validConfig,
    })).toBe('deployment_not_started');
  });

  it('reports candidate readiness only when every package boundary is ready', () => {
    const boundary = createBackendDeploymentPackageBoundary({
      enabled: true,
      backendEntryAvailable: true,
      healthCandidateAvailable: true,
      capabilitiesCandidateAvailable: true,
      readCandidateAvailable: true,
      writeCandidateAvailable: true,
      configValidation: validConfig,
    });

    expect(boundary).toMatchObject({
      state: 'candidate_ready',
      enabled: true,
      nodeOnly: true,
      capabilities: {
        backendEntryCapability: 'candidate_ready',
        startMode: 'manual_candidate_only',
        healthReadiness: 'candidate_ready',
        capabilitiesReadiness: 'candidate_ready',
        readCandidateReadiness: 'candidate_ready',
        writeCandidateReadiness: 'candidate_ready',
        deploymentState: 'candidate_ready',
        deploymentStarted: false,
        autoStart: false,
        autoListen: false,
        bindsNetworkPort: false,
      },
    });

    expect(createBackendDeploymentPackageCapabilities('deployment_not_started', {
      backendEntryAvailable: true,
      healthCandidateAvailable: true,
    })).toMatchObject({
      startMode: 'disabled',
      deploymentStarted: false,
      sourceOfTruthChanged: false,
      defaultCloudSync: false,
    });
  });

  it('does not switch source of truth or promote dev/local runtime', () => {
    const boundary = createBackendDeploymentPackageBoundary({
      enabled: true,
      backendEntryAvailable: true,
      healthCandidateAvailable: true,
      capabilitiesCandidateAvailable: true,
      readCandidateAvailable: true,
      writeCandidateAvailable: true,
      configValidation: validConfig,
    });

    expect(boundary.capabilities).toMatchObject({
      sourceOfTruthChanged: false,
      defaultCloudSync: false,
      apiPrimaryDevPromoted: false,
      devRuntimeHostedAsProduction: false,
      sqliteSnapshotPromoted: false,
      localStorageRole: 'default_fallback_migration_emergency',
    });
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('does not import server modules bind ports or add deployment config', () => {
    const source = readSource('apps/api/src/node/backendDeploymentPackageBoundary.ts');
    const packageJson = readSource('package.json');
    const browserApiIndex = readSource('apps/api/src/index.ts');
    const app = readSource('src/App.tsx');

    for (const forbidden of [
      'node:http',
      'createServer',
      'listen(',
      '.listen',
      'process.env',
      'Dockerfile',
      'vercel.json',
      'fetch(',
      '@sentry',
      'telemetryUpload',
      'analyticsUpload',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(packageJson).not.toContain('backendDeploymentPackageBoundary');
    expect(browserApiIndex).not.toContain('backendDeploymentPackageBoundary');
    expect(app).not.toContain('backendDeploymentPackageBoundary');
  });

  it('documents backend deployment package boundary and next task', () => {
    const doc = readSource('docs/BACKEND_DEPLOYMENT_PACKAGE_BOUNDARY.md');

    for (const expected of [
      'Task 13.6 Backend Deployment Package Boundary V1',
      'Node-only backend deployment package boundary',
      'deployment_disabled',
      'not_configured',
      'config_invalid',
      'candidate_ready',
      'deployment_not_started',
      'unsupported',
      'No auto-listen',
      'No port binding',
      'No package script',
      'No Docker or hosting config',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 13.7 Frontend Production Environment Separation V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
