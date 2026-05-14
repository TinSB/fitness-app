import { describe, expect, it } from 'vitest';
import {
  createAuthBrowserSafeConfig,
  resolveAuthEnvironmentCallbackGuard,
} from '../src/cloudProduction/authEnvironmentCallbackGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth environment callback guard', () => {
  it('is disabled by default with browser-safe config', () => {
    expect(resolveAuthEnvironmentCallbackGuard()).toMatchObject({
      ok: false,
      enabled: false,
      environment: 'disabled',
      browserSafeConfig: {
        enabled: false,
        providerCandidate: null,
        callbackUrl: null,
        containsSecrets: false,
      },
      errors: [{ code: 'auth_env_disabled' }],
    });
    expect(createAuthBrowserSafeConfig({
      providerCandidate: 'supabase-auth-candidate',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
    })).toEqual({
      enabled: false,
      providerCandidate: 'supabase-auth-candidate',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      containsSecrets: false,
    });
  });

  it('accepts only explicit safe production candidate config', () => {
    expect(resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      runtimeTargetUrl: 'https://api.ironpath.example',
      browserConfig: { publicMode: 'candidate' },
    })).toEqual({
      ok: true,
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      browserSafeConfig: {
        enabled: false,
        providerCandidate: 'supabase-auth-candidate',
        callbackUrl: 'https://app.ironpath.example/candidate-callback',
        containsSecrets: false,
      },
      errors: [],
    });
  });

  it('rejects missing provider config and missing callback URL', () => {
    expect(resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      environment: 'production',
    })).toMatchObject({
      ok: false,
      errors: [
        { code: 'provider_config_missing' },
        { code: 'callback_url_missing' },
      ],
    });
  });

  it('rejects unsafe localhost preview and dev-local callback targets', () => {
    expect(resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'http://localhost:3000/candidate-callback',
    }).errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'callback_url_unsafe',
      'localhost_not_allowed_for_production',
    ]));

    expect(resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'preview',
      callbackUrl: 'https://branch-preview.vercel.app/candidate-callback',
      explicitPreviewAllowed: false,
    }).errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'preview_not_production',
      'provider_not_enabled',
    ]));

    expect(resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      runtimeTargetUrl: 'api-primary-dev',
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'provider_not_enabled' }],
    });
  });

  it('rejects sensitive browser config keys without echoing values', () => {
    const result = resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      browserConfig: {
        publicMode: 'candidate',
        providerToken: 'synthetic-sensitive-value',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: 'secret_exposed_to_browser' }],
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-sensitive-value');
  });

  it('does not include SDK imports network calls auth routes or secret reads', () => {
    const source = readSource('src/cloudProduction/authEnvironmentCallbackGuard.ts');

    for (const forbidden of [
      '@supabase',
      '@clerk',
      'next-auth',
      'firebase',
      'auth0',
      'fetch(',
      'XMLHttpRequest',
      'process.env',
      '/auth',
      '/login',
      '/signup',
      'OAuth',
      'password',
      'document.cookie',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents guard boundaries and next task', () => {
    const doc = readSource('docs/AUTH_ENVIRONMENT_CALLBACK_GUARD.md');

    for (const expected of [
      'Task 11.3 Auth Environment & Callback Guard V1',
      'is disabled by default',
      'rejects missing provider config',
      'rejects unsafe callback URL',
      'Supabase Auth remains a provider candidate only.',
      'No Supabase SDK is installed.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 11.4 Auth Adapter Provider Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
