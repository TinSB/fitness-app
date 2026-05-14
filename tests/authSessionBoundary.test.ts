import { describe, expect, it } from 'vitest';
import {
  resolveAuthSessionBoundary,
  resolveLogoutSessionBoundary,
} from '../src/cloudProduction/authSessionBoundary';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth session boundary', () => {
  it('is disabled by default and keeps local app access', () => {
    expect(resolveAuthSessionBoundary()).toEqual({
      ok: false,
      state: 'disabled',
      errorCode: 'session_disabled',
      userCandidate: null,
      accountCandidate: null,
      canUseBackendPrimaryCandidate: false,
      requiresManualLinking: false,
      localAppAvailable: true,
      emergencyLocalAvailable: true,
      localStorageDeleted: false,
      emergencyBackupDeleted: false,
      localDataUploaded: false,
      sourceOfTruthChanged: false,
      message: 'Auth session boundary is disabled by default.',
    });
  });

  it('keeps unauthenticated local mode usable', () => {
    expect(resolveAuthSessionBoundary({ enabled: true })).toMatchObject({
      ok: true,
      state: 'unauthenticated',
      canUseBackendPrimaryCandidate: false,
      localAppAvailable: true,
      emergencyLocalAvailable: true,
      sourceOfTruthChanged: false,
    });
  });

  it('handles expired invalid and unavailable provider states without deleting local data', () => {
    for (const input of [
      { enabled: true, state: 'expired' as const },
      { enabled: true, state: 'invalid' as const },
      { enabled: true, providerAvailable: false },
    ]) {
      const result = resolveAuthSessionBoundary(input);

      expect(result.ok).toBe(false);
      expect(result.localAppAvailable).toBe(true);
      expect(result.emergencyLocalAvailable).toBe(true);
      expect(result.localStorageDeleted).toBe(false);
      expect(result.emergencyBackupDeleted).toBe(false);
      expect(result.localDataUploaded).toBe(false);
      expect(result.sourceOfTruthChanged).toBe(false);
    }
  });

  it('requires manual linking before backend-primary candidate use', () => {
    const result = resolveAuthSessionBoundary({
      enabled: true,
      state: 'authenticated-candidate',
      userCandidate: { userId: 'synthetic-user' },
      accountCandidate: { accountId: 'synthetic-account', ownerScope: 'cloud-account-candidate' },
    });

    expect(result).toMatchObject({
      ok: false,
      state: 'authenticated-candidate',
      errorCode: 'manual_link_required',
      canUseBackendPrimaryCandidate: false,
      requiresManualLinking: true,
      sourceOfTruthChanged: false,
    });
  });

  it('allows backend-primary candidate only after explicit manual linking', () => {
    expect(resolveAuthSessionBoundary({
      enabled: true,
      state: 'authenticated-candidate',
      userCandidate: { userId: 'synthetic-user' },
      accountCandidate: { accountId: 'synthetic-account', ownerScope: 'cloud-account-candidate' },
      manualLinkAccepted: true,
    })).toMatchObject({
      ok: true,
      state: 'authenticated-candidate',
      canUseBackendPrimaryCandidate: true,
      requiresManualLinking: false,
      localAppAvailable: true,
      emergencyLocalAvailable: true,
      localDataUploaded: false,
      sourceOfTruthChanged: false,
    });
  });

  it('does not treat incomplete candidate identity as usable', () => {
    expect(resolveAuthSessionBoundary({
      enabled: true,
      state: 'authenticated-candidate',
      userCandidate: { userId: 'synthetic-user' },
      manualLinkAccepted: true,
    })).toMatchObject({
      ok: false,
      state: 'unauthenticated',
      errorCode: 'session_missing',
      canUseBackendPrimaryCandidate: false,
    });
  });

  it('keeps logout candidate local and backup-preserving', () => {
    expect(resolveLogoutSessionBoundary({
      enabled: true,
      state: 'authenticated-candidate',
      userCandidate: { userId: 'synthetic-user' },
      accountCandidate: { accountId: 'synthetic-account', ownerScope: 'cloud-account-candidate' },
    })).toMatchObject({
      ok: true,
      state: 'unauthenticated',
      localAppAvailable: true,
      emergencyLocalAvailable: true,
      localStorageDeleted: false,
      emergencyBackupDeleted: false,
      localDataUploaded: false,
      sourceOfTruthChanged: false,
    });
  });

  it('does not import SDKs call networks or switch data source', () => {
    const source = readSource('src/cloudProduction/authSessionBoundary.ts');

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
      'localStorage.removeItem',
      'localStorage.setItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents session boundary and next task', () => {
    const doc = readSource('docs/AUTH_SESSION_BOUNDARY.md');

    for (const expected of [
      'Task 11.5 Auth Session Boundary V1',
      'Session state must not automatically switch backend-primary.',
      'Session expired must not delete localStorage.',
      'Logout must not delete emergency backup.',
      'Auth error must not block local app usage.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 11.6 Login / Logout Candidate UI V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
