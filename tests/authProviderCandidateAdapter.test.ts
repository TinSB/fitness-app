import { describe, expect, it } from 'vitest';
import {
  createDisabledProviderCandidateAdapter,
  createSupabaseAuthCandidateAdapter,
} from '../src/cloudProduction/authProviderCandidateAdapter';
import { resolveAuthEnvironmentCallbackGuard } from '../src/cloudProduction/authEnvironmentCallbackGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth adapter provider candidate', () => {
  it('is disabled by default with no SDK network or secret exposure', () => {
    const adapter = createSupabaseAuthCandidateAdapter();

    expect(adapter).toMatchObject({
      adapterName: 'disabled-provider-candidate-adapter',
      providerCandidate: null,
      networkEnabled: false,
      sdkLoaded: false,
      secretsExposed: false,
    });
    expect(adapter.getCandidateSession()).toMatchObject({
      ok: false,
      state: 'disabled',
      errorCode: 'candidate_disabled',
      secretsExposed: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('fails closed when enabled without provider candidate config', () => {
    expect(createSupabaseAuthCandidateAdapter({ enabled: true }).getCandidateSession()).toMatchObject({
      ok: false,
      state: 'provider_not_configured',
      errorCode: 'provider_config_missing',
    });
  });

  it('rejects callback guard failure before exposing fake candidate state', () => {
    const callbackGuard = resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'http://localhost:3000/candidate-callback',
    });

    expect(createSupabaseAuthCandidateAdapter({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      callbackGuard,
      fakeSession: {
        userId: 'synthetic-user',
        accountId: 'synthetic-account',
      },
    }).getCandidateSession()).toMatchObject({
      ok: false,
      state: 'unsupported',
      errorCode: 'callback_rejected',
      providerCandidate: 'supabase-auth-candidate',
      userCandidate: null,
    });
  });

  it('supports a fake Supabase Auth candidate session for tests only', () => {
    const callbackGuard = resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      runtimeTargetUrl: 'https://api.ironpath.example',
    });
    const adapter = createSupabaseAuthCandidateAdapter({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      callbackGuard,
      fakeSession: {
        userId: 'synthetic-user',
        accountId: 'synthetic-account',
        displayName: 'Synthetic Candidate',
      },
    });

    expect(adapter).toMatchObject({
      adapterName: 'supabase-auth-candidate-adapter',
      providerCandidate: 'supabase-auth-candidate',
      networkEnabled: false,
      sdkLoaded: false,
      secretsExposed: false,
    });
    expect(adapter.getCandidateSession()).toMatchObject({
      ok: true,
      state: 'provider_candidate',
      providerCandidate: 'supabase-auth-candidate',
      sessionCandidateId: 'candidate-session:synthetic-account',
      userCandidate: {
        userId: 'synthetic-user',
        accountId: 'synthetic-account',
      },
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('reports user unavailable without fake success', () => {
    const callbackGuard = resolveAuthEnvironmentCallbackGuard({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      environment: 'production',
      callbackUrl: 'https://app.ironpath.example/candidate-callback',
      runtimeTargetUrl: 'https://api.ironpath.example',
    });
    const adapter = createSupabaseAuthCandidateAdapter({
      enabled: true,
      providerCandidate: 'supabase-auth-candidate',
      callbackGuard,
    });

    expect(adapter.getCandidateUser()).toMatchObject({
      ok: false,
      state: 'user_unavailable',
      errorCode: 'user_unavailable',
      userCandidate: null,
    });
    expect(adapter.startCandidateFlow()).toMatchObject({
      ok: false,
      state: 'unsupported',
      errorCode: 'operation_unsupported',
    });
  });

  it('keeps the disabled adapter stable for static boundaries', () => {
    const adapter = createDisabledProviderCandidateAdapter();

    expect(adapter.getCandidateSession()).toMatchObject({
      state: 'disabled',
      errorCode: 'candidate_disabled',
    });
    expect(adapter.endCandidateFlow()).toMatchObject({
      state: 'unsupported',
      errorCode: 'operation_unsupported',
    });
  });

  it('does not import SDKs call networks expose secrets or mutate local data', () => {
    const source = readSource('src/cloudProduction/authProviderCandidateAdapter.ts');

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
      'token storage',
      'document.cookie',
      'localStorage.setItem',
      'sessionStorage.setItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents adapter candidate boundaries and next task', () => {
    const doc = readSource('docs/AUTH_ADAPTER_PROVIDER_CANDIDATE.md');

    for (const expected of [
      'Task 11.4 Auth Adapter Provider Candidate V1',
      'Supabase Auth is represented as a provider candidate only.',
      'No Supabase SDK is installed or imported.',
      'No real provider network call is performed.',
      'Fake provider candidate sessions are synthetic test-only data.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 11.5 Auth Session Boundary V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
