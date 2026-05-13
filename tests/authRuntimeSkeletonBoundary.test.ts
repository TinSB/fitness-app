import { describe, expect, it } from 'vitest';
import {
  createAuthRuntimeSkeleton,
  createDisabledAuthProviderAdapter,
  type AuthProviderAdapter,
} from '../src/cloudProduction/authRuntimeSkeleton';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth runtime skeleton boundary', () => {
  it('is disabled by default with a safe unauthenticated shape', () => {
    const auth = createAuthRuntimeSkeleton();

    expect(auth).toMatchObject({
      status: 'disabled',
      providerName: null,
      enabled: false,
      providerConfigured: false,
      secretsExposed: false,
    });
    expect(auth.getSession()).toEqual({
      ok: false,
      status: 'disabled',
      user: null,
      tokenPresent: false,
      secretsExposed: false,
      errorCode: 'auth_disabled',
      message: 'Auth runtime is disabled by default.',
    });
  });

  it('keeps login and logout unsupported on the disabled adapter', () => {
    const adapter = createDisabledAuthProviderAdapter();

    expect(adapter.providerName).toBe('disabled-auth-adapter');
    expect(adapter.login()).toMatchObject({
      ok: false,
      status: 'unsupported',
      errorCode: 'auth_not_implemented',
    });
    expect(adapter.logout()).toMatchObject({
      ok: false,
      status: 'unsupported',
      errorCode: 'auth_not_implemented',
    });
  });

  it('fails closed when enabled without a provider or with an unsafe environment', () => {
    expect(createAuthRuntimeSkeleton({ enabled: true }).getSession()).toMatchObject({
      ok: false,
      status: 'provider_not_configured',
      errorCode: 'provider_not_configured',
    });

    expect(createAuthRuntimeSkeleton({ enabled: true, environmentSafe: false }).getSession()).toMatchObject({
      ok: false,
      status: 'unsupported',
      errorCode: 'unsafe_environment',
    });
  });

  it('supports only injected adapter candidates without provider SDKs or secrets', () => {
    const candidateProvider: AuthProviderAdapter = {
      providerName: 'synthetic-candidate-provider',
      getSession: () => ({
        ok: true,
        status: 'unauthenticated',
        user: null,
        tokenPresent: false,
        secretsExposed: false,
        message: 'Synthetic candidate session only.',
      }),
      login: () => ({
        ok: false,
        status: 'unsupported',
        user: null,
        tokenPresent: false,
        secretsExposed: false,
        errorCode: 'auth_not_implemented',
        message: 'Synthetic login unsupported.',
      }),
      logout: () => ({
        ok: true,
        status: 'unauthenticated',
        user: null,
        tokenPresent: false,
        secretsExposed: false,
        message: 'Synthetic logout no-op.',
      }),
    };

    const auth = createAuthRuntimeSkeleton({ enabled: true, provider: candidateProvider });

    expect(auth).toMatchObject({
      status: 'unauthenticated',
      providerName: 'synthetic-candidate-provider',
      enabled: true,
      providerConfigured: true,
      secretsExposed: false,
    });
    expect(auth.getSession()).toMatchObject({
      ok: true,
      status: 'unauthenticated',
      tokenPresent: false,
      secretsExposed: false,
    });
  });

  it('does not import provider SDKs, network APIs, Node-only modules, or App runtime', () => {
    const source = readSource('src/cloudProduction/authRuntimeSkeleton.ts');
    const app = readSource('src/App.tsx');

    for (const forbidden of [
      '@clerk',
      'next-auth',
      '@supabase',
      'firebase',
      'auth0',
      'fetch(',
      'XMLHttpRequest',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'process.env',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(app).not.toContain('authRuntimeSkeleton');
  });

  it('documents the auth skeleton boundaries and next task', () => {
    const doc = readSource('docs/AUTH_RUNTIME_SKELETON_BOUNDARY.md');

    for (const expected of [
      'Task 10.4 Auth Runtime Skeleton Boundary V1',
      'Auth is disabled by default.',
      'No provider SDK is imported.',
      'No provider dependency is added.',
      'No provider network call is performed.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend-primary candidate remains explicit opt-in and reversible.',
      'Recommended next task: Task 10.5 Account-Scoped AppData Boundary V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
