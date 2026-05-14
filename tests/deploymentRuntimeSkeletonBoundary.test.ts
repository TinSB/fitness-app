import { describe, expect, it } from 'vitest';
import {
  createDeploymentRuntimeSkeleton,
  getDeploymentRuntimeCapabilities,
  validateDeploymentRuntimeConfig,
} from '../src/cloudProduction/deploymentRuntimeSkeleton';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('deployment runtime skeleton boundary', () => {
  it('is disabled by default and cannot deploy or start servers', () => {
    expect(createDeploymentRuntimeSkeleton()).toMatchObject({
      ok: false,
      status: 'disabled',
      enabled: false,
      targetKind: null,
      canDeploy: false,
      canStartServer: false,
      hasHostingConfig: false,
      packageScriptsRequired: false,
      errors: [{ code: 'deployment_disabled' }],
    });
  });

  it('validates readiness status without implementing deployment', () => {
    expect(getDeploymentRuntimeCapabilities({
      enabled: true,
      targetKind: 'separate-node-api',
      productionUrl: 'https://api.ironpath.example',
    })).toEqual({
      status: 'ready_candidate',
      enabled: true,
      targetKind: 'separate-node-api',
      canDeploy: false,
      canStartServer: false,
      hasHostingConfig: false,
      packageScriptsRequired: false,
    });

    expect(validateDeploymentRuntimeConfig({
      enabled: true,
      targetKind: 'separate-node-api',
      productionUrl: 'https://api.ironpath.example',
    })).toMatchObject({
      ok: false,
      status: 'deployment_not_implemented',
      errors: [{ code: 'deployment_not_implemented' }],
    });
  });

  it('rejects unsafe or incomplete config', () => {
    expect(validateDeploymentRuntimeConfig({ enabled: true })).toMatchObject({
      ok: false,
      status: 'not_configured',
      errors: [
        { code: 'target_required' },
        { code: 'production_url_required' },
      ],
    });
    expect(validateDeploymentRuntimeConfig({
      enabled: true,
      targetKind: 'separate-node-api',
      productionUrl: 'http://localhost:3000',
    })).toMatchObject({
      ok: false,
      status: 'config_invalid',
      errors: [{ code: 'production_url_invalid' }],
    });
    expect(validateDeploymentRuntimeConfig({
      enabled: true,
      targetKind: 'separate-node-api',
      productionUrl: 'https://api.ironpath.example',
      hostingConfigPresent: true,
    })).toMatchObject({
      ok: false,
      status: 'config_invalid',
      errors: [{ code: 'hosting_config_not_implemented' }],
    });
  });

  it('does not include deployment config, server startup, provider SDKs, or package-script behavior', () => {
    const source = readSource('src/cloudProduction/deploymentRuntimeSkeleton.ts');

    for (const forbidden of [
      'listen(',
      'createServer',
      'vercel.json',
      'Dockerfile',
      '.github/workflows',
      'Start-Process',
      'child_process',
      'package.json',
      'fetch(',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents disabled deployment boundaries and next task', () => {
    const doc = readSource('docs/DEPLOYMENT_RUNTIME_SKELETON_BOUNDARY.md');

    for (const expected of [
      'Task 10.10 Deployment Runtime Skeleton Boundary V1',
      'Deployment runtime is disabled by default.',
      'never deploys',
      'never starts a server',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 10.11 Monitoring & Audit Event Boundary V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
