import { describe, expect, it } from 'vitest';
import {
  classifyProductionDeploymentBackendUrl,
  classifySupabaseDeploymentProject,
  createBrowserSafeProductionDeploymentConfig,
  resolveProductionDeploymentConfigGuard,
} from '../src/cloudProduction/productionDeploymentConfigGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production deployment config guard', () => {
  it('is disabled by default and emits browser-safe disabled config', () => {
    expect(resolveProductionDeploymentConfigGuard()).toMatchObject({
      ok: false,
      enabled: false,
      environment: 'disabled',
      target: 'production-candidate',
      deploymentStarted: false,
      noExternalUpload: true,
      errors: [{ code: 'deployment_disabled' }],
    });

    expect(createBrowserSafeProductionDeploymentConfig({
      environment: 'production-candidate',
      target: 'production-candidate',
      backendBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectUrl: 'https://project.supabase.co',
    })).toEqual({
      enabled: false,
      environment: 'production-candidate',
      target: 'production-candidate',
      backendBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectUrl: 'https://project.supabase.co',
      serviceRoleExposed: false,
      containsSecrets: false,
      deploymentStarted: false,
    });
  });

  it('classifies backend and Supabase project candidates without connecting to them', () => {
    expect(classifyProductionDeploymentBackendUrl()).toBe('missing');
    expect(classifyProductionDeploymentBackendUrl('http://api.ironpath.example')).toBe('invalid');
    expect(classifyProductionDeploymentBackendUrl('https://localhost:5173')).toBe('dev-local');
    expect(classifyProductionDeploymentBackendUrl('https://api-primary-dev.ironpath.example')).toBe('dev-local');
    expect(classifyProductionDeploymentBackendUrl('https://branch-preview.vercel.app')).toBe('preview');
    expect(classifyProductionDeploymentBackendUrl('https://api-candidate.ironpath.example')).toBe('production-candidate');
    expect(classifyProductionDeploymentBackendUrl('https://api.ironpath.example')).toBe('production');

    expect(classifySupabaseDeploymentProject()).toBe('missing');
    expect(classifySupabaseDeploymentProject('http://project.supabase.co')).toBe('invalid');
    expect(classifySupabaseDeploymentProject('https://localhost')).toBe('local');
    expect(classifySupabaseDeploymentProject('https://branch-preview.vercel.app')).toBe('preview');
    expect(classifySupabaseDeploymentProject('https://test-project.supabase.co')).toBe('test');
    expect(classifySupabaseDeploymentProject('https://project.supabase.co', 'production-candidate')).toBe('production-candidate');
  });

  it('rejects missing config without silent success', () => {
    const result = resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'backend_url_missing',
      'config_incomplete',
    ]));
  });

  it('rejects localhost preview and dev API production targets', () => {
    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
      backendBaseUrl: 'https://localhost:3000',
      runtimeSource: 'api-primary-dev',
      supabaseProjectUrl: 'https://project.supabase.co',
      supabaseProjectClassification: 'production',
    }).errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'localhost_not_production',
      'dev_api_not_production',
    ]));

    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'preview',
      target: 'production',
      backendBaseUrl: 'https://branch-preview.vercel.app',
      supabaseProjectUrl: 'https://project.supabase.co',
      supabaseProjectClassification: 'production',
    }).errors.map((item) => item.code)).toContain('preview_not_production');
  });

  it('rejects service role exposure and does not echo secret values', () => {
    const result = resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      supabaseProjectUrl: 'https://project.supabase.co',
      supabaseProjectClassification: 'production',
      serviceRoleKeyPresentInBrowserConfig: true,
      browserConfig: {
        publicBaseUrl: 'https://api.ironpath.example',
        serviceRoleValue: 'synthetic-secret-value',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'service_role_not_browser_safe' }),
    ]));
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('rejects Supabase test and preview projects as production', () => {
    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      supabaseProjectUrl: 'https://test-project.supabase.co',
    })).toMatchObject({
      ok: false,
      supabaseProjectClassification: 'test',
      errors: [{ code: 'supabase_project_not_production' }],
    });

    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production-candidate',
      target: 'production-candidate',
      backendBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectUrl: 'https://branch-preview.vercel.app',
      supabaseProjectClassification: 'preview',
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'supabase_project_not_production' }],
    });
  });

  it('accepts explicit production-candidate and production classifications without starting deployment', () => {
    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production-candidate',
      target: 'production-candidate',
      backendBaseUrl: 'https://api-candidate.ironpath.example',
      supabaseProjectUrl: 'https://project-candidate.supabase.co',
      supabaseProjectClassification: 'production-candidate',
      browserConfig: { publicReleaseChannel: 'production-candidate' },
    })).toEqual({
      ok: true,
      enabled: true,
      environment: 'production-candidate',
      target: 'production-candidate',
      backendClassification: 'production-candidate',
      supabaseProjectClassification: 'production-candidate',
      browserSafeConfig: {
        enabled: false,
        environment: 'production-candidate',
        target: 'production-candidate',
        backendBaseUrl: 'https://api-candidate.ironpath.example',
        supabaseProjectUrl: 'https://project-candidate.supabase.co',
        serviceRoleExposed: false,
        containsSecrets: false,
        deploymentStarted: false,
      },
      deploymentStarted: false,
      noExternalUpload: true,
      errors: [],
    });

    expect(resolveProductionDeploymentConfigGuard({
      enabled: true,
      environment: 'production',
      target: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      supabaseProjectUrl: 'https://project.supabase.co',
      supabaseProjectClassification: 'production',
    })).toMatchObject({
      ok: true,
      deploymentStarted: false,
      noExternalUpload: true,
      errors: [],
    });
  });

  it('does not read env files import SDKs start deployment or add external transport', () => {
    const source = readSource('src/cloudProduction/productionDeploymentConfigGuard.ts');

    for (const forbidden of [
      'process.env',
      '@supabase',
      'supabase-js',
      'fetch(',
      'XMLHttpRequest',
      'listen(',
      'createServer',
      'node:http',
      'node:sqlite',
      'Dockerfile',
      'vercel.json',
      'autoDeploy',
      'deployProductionNow',
      'telemetryUpload',
      'analyticsUpload',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
      'localStorage.setItem',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents deployment guard boundaries and next task', () => {
    const doc = readSource('docs/PRODUCTION_DEPLOYMENT_CONFIG_GUARD.md');

    for (const expected of [
      'Task 13.5 Production Runtime Deployment Config Guard V1',
      'disabled by default',
      'does not deploy, start, bind, or launch production',
      'Rejects localhost as production backend',
      'Rejects preview environment as production unless explicitly classified',
      'Rejects service role key in browser-safe config',
      'Rejects dev API base URL in production',
      'Supabase test project is not production',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 13.6 Backend Deployment Package Boundary V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
