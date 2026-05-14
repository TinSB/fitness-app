import { describe, expect, it } from 'vitest';
import {
  classifyFrontendApiBaseUrl,
  createBrowserSafeReleaseChannelInfo,
  createFrontendEnvironmentCapabilities,
  resolveFrontendProductionEnvironmentSeparation,
} from '../src/cloudProduction/frontendProductionEnvironmentSeparation';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('frontend production environment separation', () => {
  it('distinguishes all frontend release environments with browser-safe info', () => {
    for (const environment of [
      'local',
      'dev',
      'preview',
      'production-candidate',
      'production',
      'emergency-local',
    ] as const) {
      expect(createBrowserSafeReleaseChannelInfo(environment)).toMatchObject({
        environment,
        releaseChannel: environment,
        emergencyLocalAvailable: true,
        containsSecrets: false,
      });
    }
  });

  it('classifies frontend API URLs without connecting to them', () => {
    expect(classifyFrontendApiBaseUrl()).toBe('missing');
    expect(classifyFrontendApiBaseUrl('http://localhost:5173')).toBe('dev-local');
    expect(classifyFrontendApiBaseUrl('https://api-primary-dev.ironpath.example')).toBe('dev-local');
    expect(classifyFrontendApiBaseUrl('https://branch-preview.vercel.app')).toBe('preview');
    expect(classifyFrontendApiBaseUrl('https://api-candidate.ironpath.example')).toBe('production-candidate');
    expect(classifyFrontendApiBaseUrl('https://api.ironpath.example')).toBe('production');
  });

  it('keeps cloud candidates manual and disabled by default', () => {
    expect(createFrontendEnvironmentCapabilities('production-candidate')).toEqual({
      localStoragePrimary: true,
      backendCloudCandidateAllowed: false,
      cloudPullCandidateAllowed: false,
      cloudPullApplyAllowed: false,
      cloudPushCandidateAllowed: false,
      manualConflictResolutionAllowed: true,
      monitoringCandidateAllowed: true,
      productionDeploymentCandidateAllowed: true,
      sourceOfTruthSwitchAllowed: false,
      defaultCloudSync: false,
      noAutomaticWorker: true,
    });

    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      supabaseProjectClass: 'production-candidate',
      cloudCandidateRequested: true,
    })).toMatchObject({
      ok: false,
      cloudCandidateAutoEnabled: false,
      sourceOfTruthChanged: false,
      localStorageUnchanged: true,
      errors: [{ code: 'cloud_candidate_manual_enable_required' }],
    });
  });

  it('allows production-candidate manual checks without cloud push or source switch', () => {
    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      apiBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectClass: 'production-candidate',
      cloudCandidateRequested: true,
      manualCloudCandidateEnabled: true,
    })).toMatchObject({
      ok: true,
      environment: 'production-candidate',
      capabilities: {
        backendCloudCandidateAllowed: true,
        cloudPullCandidateAllowed: true,
        cloudPullApplyAllowed: false,
        cloudPushCandidateAllowed: false,
        sourceOfTruthSwitchAllowed: false,
        defaultCloudSync: false,
      },
      sourceOfTruthChanged: false,
      cloudCandidateAutoEnabled: false,
      errors: [],
    });
  });

  it('blocks preview production cloud write and production dev API usage', () => {
    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'preview',
      apiBaseUrl: 'https://branch-preview.vercel.app',
      supabaseProjectClass: 'preview',
      cloudPushRequested: true,
    }).errors.map((item) => item.code)).toContain('preview_cloud_write_blocked');

    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production',
      apiBaseUrl: 'https://localhost:5173',
      runtimeSource: 'api-primary-dev',
      supabaseProjectClass: 'production',
    }).errors.map((item) => item.code)).toContain('production_dev_api_blocked');
  });

  it('blocks local test and preview Supabase projects for production channels', () => {
    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production',
      apiBaseUrl: 'https://api.ironpath.example',
      supabaseProjectClass: 'local',
    }).errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'local_supabase_not_production',
      'config_incomplete',
    ]));

    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      apiBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectClass: 'test',
    }).errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'local_supabase_not_production',
      'config_incomplete',
    ]));
  });

  it('blocks cloud pull apply and source-of-truth switch requests', () => {
    expect(resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      apiBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectClass: 'production-candidate',
      manualCloudCandidateEnabled: true,
      cloudPullApplyRequested: true,
      sourceOfTruthSwitchRequested: true,
    })).toMatchObject({
      ok: false,
      sourceOfTruthChanged: false,
      localStorageUnchanged: true,
      errors: [{ code: 'source_of_truth_switch_blocked' }],
    });
  });

  it('rejects secret-like browser config keys without echoing values', () => {
    const result = resolveFrontendProductionEnvironmentSeparation({
      environment: 'production-candidate',
      apiBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectClass: 'production-candidate',
      browserConfig: {
        publicReleaseChannel: 'production-candidate',
        serviceRoleValue: 'synthetic-secret-value',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'secret_exposed_to_browser' }),
    ]));
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('does not read env files import SDKs write local storage or add external transport', () => {
    const source = readSource('src/cloudProduction/frontendProductionEnvironmentSeparation.ts');

    for (const forbidden of [
      'process.env',
      '@supabase',
      'supabase-js',
      'fetch(',
      'XMLHttpRequest',
      'localStorage.setItem',
      'api-primary-dev',
      'devApiRunner',
      'node:http',
      'node:sqlite',
      'autoDeploy',
      'deployProductionNow',
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
  });

  it('documents frontend environment separation boundaries and next task', () => {
    const doc = readSource('docs/FRONTEND_PRODUCTION_ENVIRONMENT_SEPARATION.md');

    for (const expected of [
      'Task 13.7 Frontend Production Environment Separation V1',
      'local',
      'dev',
      'preview',
      'production-candidate',
      'production',
      'emergency-local',
      'Prevent preview from enabling production cloud write',
      'Prevent production from using dev API',
      'Prevent local env from being treated as production Supabase',
      'Prevent cloud candidate auto-enable',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 13.8 Release Capability Matrix V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
