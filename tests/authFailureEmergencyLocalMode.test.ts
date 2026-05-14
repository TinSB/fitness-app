import { describe, expect, it } from 'vitest';
import {
  resolveAuthFailureEmergencyLocalMode,
  type AuthFailureEmergencyReason,
} from '../src/cloudProduction/authFailureEmergencyLocalMode';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth failure logout emergency local mode', () => {
  it('keeps local and emergency modes available for every required failure reason', () => {
    const reasons: AuthFailureEmergencyReason[] = [
      'provider_unavailable',
      'session_expired',
      'session_invalid',
      'user_mismatch',
      'owner_mismatch',
      'logout',
      'callback_error',
      'token_missing',
      'account_unlink_rejected',
    ];

    for (const reason of reasons) {
      expect(resolveAuthFailureEmergencyLocalMode({
        reason,
        backendPrimaryEnabled: true,
      })).toMatchObject({
        localAppAvailable: true,
        fallbackLocalStorageAvailable: true,
        emergencyLocalAvailable: true,
        backendPrimaryDisabled: true,
        localDataDeleted: false,
        cloudDataOverwritten: false,
        sourceOfTruthChanged: false,
        fakeSuccessAccepted: false,
        reason,
      });
    }
  });

  it('returns safe recommended actions for common auth failures', () => {
    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'provider_unavailable',
    })).toMatchObject({
      ok: false,
      recommendedAction: 'retry_candidate_later',
    });

    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'session_expired',
    })).toMatchObject({
      ok: false,
      recommendedAction: 'continue_local',
    });

    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'owner_mismatch',
    })).toMatchObject({
      ok: false,
      recommendedAction: 'manual_owner_review',
    });
  });

  it('handles logout as a local-mode transition without deleting emergency backup', () => {
    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'logout',
      backendPrimaryEnabled: true,
    })).toMatchObject({
      ok: true,
      recommendedAction: 'return_to_local_mode',
      backendPrimaryDisabled: true,
      localDataDeleted: false,
      emergencyLocalAvailable: true,
    });
  });

  it('does not accept fake success when candidate reports success during failure', () => {
    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'callback_error',
      candidateClaimedSuccess: true,
    })).toMatchObject({
      ok: false,
      fakeSuccessAccepted: false,
      recommendedAction: 'reject_candidate_success',
      localDataDeleted: false,
      cloudDataOverwritten: false,
    });
  });

  it('reports unavailable fallback or emergency state without deleting data', () => {
    expect(resolveAuthFailureEmergencyLocalMode({
      reason: 'session_invalid',
      fallbackLocalStorageAvailable: false,
      emergencyBackupAvailable: false,
    })).toMatchObject({
      fallbackLocalStorageAvailable: false,
      emergencyLocalAvailable: false,
      localDataDeleted: false,
      cloudDataOverwritten: false,
      sourceOfTruthChanged: false,
    });
  });

  it('does not import SDKs call networks upload data or remove local backup', () => {
    const source = readSource('src/cloudProduction/authFailureEmergencyLocalMode.ts');

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
      'localStorage.setItem',
      'localStorage.removeItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents failure emergency local mode boundaries and next task', () => {
    const doc = readSource('docs/AUTH_FAILURE_LOGOUT_EMERGENCY_LOCAL_MODE.md');

    for (const expected of [
      'Task 11.9 Auth Failure / Logout / Emergency Local Mode V1',
      'provider unavailable',
      'session expired',
      'session invalid',
      'user mismatch',
      'owner mismatch',
      'logout',
      'callback error',
      'token missing',
      'account unlink rejected',
      'No local data deletion is performed.',
      'No cloud data overwrite is performed.',
      'Recommended next task: Task 11.10 Auth Provider Manual Acceptance V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
