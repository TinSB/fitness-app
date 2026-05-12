import { describe, expect, it } from 'vitest';
import {
  AUTH_PROVIDER_ADAPTER_KIND,
  createAuthProviderAdapterSkeleton,
  createAuthUnavailableResult,
  isAuthRuntimeImplemented,
} from '../src/auth/authBoundary';
import type { AuthAccountIdentity, AuthProviderAdapterSkeleton } from '../src/auth/authProviderTypes';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth provider adapter skeleton', () => {
  it('exports type/interface-only account identity shapes', () => {
    const identity: AuthAccountIdentity = {
      accountId: 'acct-test',
      providerSubjectId: 'subject-test',
      displayName: 'Test Account',
    };

    expect(identity).toEqual({
      accountId: 'acct-test',
      providerSubjectId: 'subject-test',
      displayName: 'Test Account',
    });
  });

  it('creates a pure unavailable boundary without real auth runtime', () => {
    const adapter: AuthProviderAdapterSkeleton = createAuthProviderAdapterSkeleton();

    expect(adapter.kind).toBe(AUTH_PROVIDER_ADAPTER_KIND);
    expect(adapter.runtime).toBe('not-implemented');
    expect(adapter.resolveCurrentIdentity()).toEqual(createAuthUnavailableResult());
    expect(isAuthRuntimeImplemented()).toBe(false);
  });

  it('does not store credentials, start provider flows, or add dependencies', () => {
    const source = [
      readSource('src/auth/authProviderTypes.ts'),
      readSource('src/auth/authBoundary.ts'),
    ].join('\n');

    for (const forbidden of [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'document.cookie',
      'OAuth',
      'password',
      'Bearer',
      '/login',
      '/signup',
      'fetch(',
      'window.location',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
