import { describe, expect, it } from 'vitest';
import {
  classifyCloudProductionBackendUrl,
  createBrowserSafeCloudProductionConfig,
  resolveProductionSecretsEnvironmentGuard,
} from '../src/cloudProduction/productionSecretsEnvironmentGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production secrets and environment guard', () => {
  it('is disabled by default and produces browser-safe config without secrets', () => {
    expect(resolveProductionSecretsEnvironmentGuard()).toMatchObject({
      ok: false,
      enabled: false,
      environmentKind: 'disabled',
      browserSafeConfig: {
        enabled: false,
        backendBaseUrl: null,
        containsSecrets: false,
      },
      errors: [{ code: 'cloud_runtime_disabled' }],
    });
    expect(createBrowserSafeCloudProductionConfig({
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
    })).toEqual({
      enabled: false,
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      containsSecrets: false,
    });
  });

  it('classifies production, preview, dev-local, invalid, and missing backend URLs', () => {
    expect(classifyCloudProductionBackendUrl()).toBe('missing');
    expect(classifyCloudProductionBackendUrl('http://localhost:5173')).toBe('dev-local');
    expect(classifyCloudProductionBackendUrl('https://branch-preview.vercel.app')).toBe('preview');
    expect(classifyCloudProductionBackendUrl('http://api.ironpath.example')).toBe('invalid');
    expect(classifyCloudProductionBackendUrl('https://api.ironpath.example')).toBe('production');
  });

  it('rejects missing secrets, localhost, preview, and dev runtime sources for production cloud runtime', () => {
    expect(resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'production',
      backendBaseUrl: 'http://localhost:5173',
      requiredSecretPresent: true,
    })).toMatchObject({
      ok: false,
      backendClassification: 'dev-local',
      errors: [{ code: 'backend_url_not_production' }],
    });

    const previewResult = resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'preview',
      backendBaseUrl: 'https://branch-preview.vercel.app',
      requiredSecretPresent: true,
    });
    expect(previewResult).toMatchObject({
      ok: false,
    });
    expect(previewResult.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'preview_not_production' }),
      expect.objectContaining({ code: 'backend_url_not_production' }),
    ]));

    expect(resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      runtimeSource: 'api-primary-dev',
      requiredSecretPresent: true,
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'dev_runtime_not_production' }],
    });

    expect(resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'secret_required_for_future_runtime' }],
    });
  });

  it('rejects secret-like browser config keys without echoing values', () => {
    const result = resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      requiredSecretPresent: true,
      browserConfig: {
        publicBaseUrl: 'https://api.ironpath.example',
        authToken: 'synthetic-secret-value',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: 'secret_exposed_to_browser_config' }],
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('accepts only explicit future production classification while keeping browser config disabled', () => {
    expect(resolveProductionSecretsEnvironmentGuard({
      enabled: true,
      environmentKind: 'production',
      backendBaseUrl: 'https://api.ironpath.example',
      requiredSecretPresent: true,
      browserConfig: {
        publicBaseUrl: 'https://api.ironpath.example',
      },
    })).toEqual({
      ok: true,
      enabled: true,
      environmentKind: 'production',
      backendClassification: 'production',
      browserSafeConfig: {
        enabled: false,
        environmentKind: 'production',
        backendBaseUrl: 'https://api.ironpath.example',
        containsSecrets: false,
      },
      errors: [],
    });
  });

  it('does not read process env, import provider SDKs, or use Node-only modules', () => {
    const source = readSource('src/cloudProduction/productionSecretsEnvironmentGuard.ts');

    for (const forbidden of [
      'process.env',
      '@clerk',
      'next-auth',
      '@supabase',
      'firebase',
      'auth0',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'fetch(',
      'localStorage.setItem',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents secrets/environment boundaries and next task', () => {
    const doc = readSource('docs/PRODUCTION_SECRETS_ENVIRONMENT_GUARD.md');

    for (const expected of [
      'Task 10.8 Production Secrets & Environment Guard V1',
      'is disabled by default',
      'rejects preview environment as production cloud runtime',
      'rejects localhost and development backend URLs as production',
      'returns browser-safe config with `containsSecrets: false`',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 10.9 Deployment Target Architecture Decision V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
