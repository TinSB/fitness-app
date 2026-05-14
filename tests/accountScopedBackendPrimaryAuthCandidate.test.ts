import { describe, expect, it } from 'vitest';
import { resolveAccountScopedBackendPrimaryAuthCandidate } from '../src/cloudProduction/accountScopedBackendPrimaryAuthCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

const anonymousLocalOwner = {
  scope: 'anonymous-local' as const,
  ownerId: 'local-owner-1',
  deviceId: 'device-1',
};

const deviceOwner = {
  scope: 'device-local' as const,
  ownerId: 'local-owner-1',
  deviceId: 'device-1',
};

const backendOwner = {
  scope: 'backend-primary-candidate' as const,
  ownerId: 'local-owner-1',
  deviceId: 'device-1',
};

const cloudOwner = {
  scope: 'cloud-account-candidate' as const,
  ownerId: 'account-1',
  accountId: 'account-1',
  deviceId: 'device-1',
};

describe('account scoped backend-primary auth candidate', () => {
  it('allows matching cloud account candidate owner when backend-primary is explicit', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      authUserCandidate: { userId: 'synthetic-user', accountId: 'account-1' },
      accountOwnerCandidate: cloudOwner,
      deviceOwner,
      localOwner: cloudOwner,
    })).toMatchObject({
      ok: true,
      ownerScopeMatched: true,
      backendPrimaryCandidateAllowed: true,
      cloudSyncAvailable: false,
      normalizedTablesCreated: false,
      sourceOfTruthChanged: false,
    });
  });

  it('rejects owner mismatch between auth user and account owner candidate', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      authUserCandidate: { userId: 'synthetic-user', accountId: 'account-2' },
      accountOwnerCandidate: cloudOwner,
      localOwner: cloudOwner,
    })).toMatchObject({
      ok: false,
      errorCode: 'owner_scope_mismatch',
      backendPrimaryCandidateAllowed: false,
    });
  });

  it('rejects missing auth or account candidates', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      accountOwnerCandidate: cloudOwner,
      localOwner: cloudOwner,
    })).toMatchObject({
      ok: false,
      errorCode: 'auth_candidate_missing',
    });

    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      authUserCandidate: { userId: 'synthetic-user' },
      localOwner: anonymousLocalOwner,
    })).toMatchObject({
      ok: false,
      errorCode: 'account_candidate_missing',
    });
  });

  it('requires backend-primary candidate opt-in', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      authUserCandidate: { userId: 'synthetic-user', accountId: 'account-1' },
      accountOwnerCandidate: cloudOwner,
      localOwner: cloudOwner,
    })).toMatchObject({
      ok: false,
      errorCode: 'backend_primary_not_enabled',
      backendPrimaryCandidateAllowed: false,
    });
  });

  it('accepts anonymous local and backend-primary candidate owner contexts without cloud sync', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      authUserCandidate: { userId: 'synthetic-user' },
      accountOwnerCandidate: backendOwner,
      deviceOwner,
      localOwner: anonymousLocalOwner,
    })).toMatchObject({
      ok: true,
      backendPrimaryCandidateAllowed: true,
      cloudSyncAvailable: false,
      sourceOfTruthChanged: false,
    });
  });

  it('blocks cloud sync requests explicitly', () => {
    expect(resolveAccountScopedBackendPrimaryAuthCandidate({
      backendPrimaryEnabled: true,
      cloudSyncRequested: true,
      authUserCandidate: { userId: 'synthetic-user', accountId: 'account-1' },
      accountOwnerCandidate: cloudOwner,
      localOwner: cloudOwner,
    })).toMatchObject({
      ok: false,
      errorCode: 'cloud_sync_not_available',
      cloudSyncAvailable: false,
    });
  });

  it('does not import SDKs call networks add databases or switch source-of-truth', () => {
    const source = readSource('src/cloudProduction/accountScopedBackendPrimaryAuthCandidate.ts');

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
      '/account',
      '/login',
      '/signup',
      'OAuth',
      'password',
      'token storage',
      'document.cookie',
      'CREATE TABLE',
      'ALTER TABLE',
      'DROP TABLE',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents account-scoped backend-primary auth candidate boundaries and next task', () => {
    const doc = readSource('docs/ACCOUNT_SCOPED_BACKEND_PRIMARY_AUTH_CANDIDATE.md');

    for (const expected of [
      'Task 11.8 Account-Scoped Backend-Primary Auth Candidate V1',
      'No real multi-user database is implemented.',
      'No normalized tables are added.',
      'No cloud sync is implemented.',
      'backend-primary candidate remains explicit opt-in',
      'cloud_sync_not_available',
      'Recommended next task: Task 11.9 Auth Failure / Logout / Emergency Local Mode V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
