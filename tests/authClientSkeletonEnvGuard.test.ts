import { describe, expect, it } from 'vitest';
import {
  buildPhase19eAuthClientSkeleton,
  PHASE19E_AUTH_CLIENT_SKELETON_ID,
} from '../src/cloudProduction/authClientSkeletonEnvGuard';

const safeInput = () => ({
  enabled: true,
  supabaseProject: {
    enabled: true,
    environment: 'production' as const,
    projectUrl: 'https://project.supabase.co',
    anonKey: 'synthetic-anon-key',
    browserConfig: { publicMode: 'candidate' },
  },
  authCallback: {
    enabled: true,
    providerCandidate: 'supabase-auth-candidate' as const,
    environment: 'production' as const,
    callbackUrl: 'https://app.ironpath.example/candidate-callback',
    runtimeTargetUrl: 'https://api.ironpath.example',
    browserConfig: { publicMode: 'candidate' },
  },
});

describe('Phase 19E auth client skeleton env guard', () => {
  it('is disabled by default and keeps login optional', () => {
    const skeleton = buildPhase19eAuthClientSkeleton();

    expect(skeleton).toMatchObject({
      id: PHASE19E_AUTH_CLIENT_SKELETON_ID,
      phase: '19E',
      status: 'disabled',
      enabled: false,
      clientCandidateReady: false,
      clientCreated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      loginRequired: false,
      networkAttempted: false,
      localStorageChanged: false,
      sourceOfTruthChanged: false,
      serviceRoleExposed: false,
      secretsExposed: false,
      blockers: ['auth_client_disabled'],
    });
    expect(skeleton.getSession()).toMatchObject({
      ok: false,
      action: 'get_session',
      status: 'disabled',
      errorCode: 'auth_client_disabled',
      networkAttempted: false,
      localStorageChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('accepts safe production candidate env without creating a real client or requiring login', () => {
    const skeleton = buildPhase19eAuthClientSkeleton(safeInput());

    expect(skeleton).toMatchObject({
      status: 'ready_candidate',
      enabled: true,
      clientCandidateReady: true,
      clientCreated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      loginRequired: false,
      browserSafeConfig: {
        providerCandidate: 'supabase-auth-candidate',
        projectUrl: 'https://project.supabase.co',
        callbackUrl: 'https://app.ironpath.example/candidate-callback',
        anonKeyClassified: 'public_anon_candidate',
        containsSecrets: false,
        serviceRoleExposed: false,
      },
      blockers: ['auth_runtime_deferred', 'sync_runtime_deferred'],
    });
    expect(skeleton.guards.supabaseProject.ok).toBe(true);
    expect(skeleton.guards.authCallback.ok).toBe(true);
  });

  it('fails closed on unsafe project and callback environment', () => {
    const skeleton = buildPhase19eAuthClientSkeleton({
      enabled: true,
      supabaseProject: {
        enabled: true,
        environment: 'production',
        projectUrl: 'http://localhost:54321',
        anonKey: 'synthetic-anon-key',
        serviceRoleKeyPresent: true,
      },
      authCallback: {
        enabled: true,
        providerCandidate: 'supabase-auth-candidate',
        environment: 'production',
        callbackUrl: 'http://localhost:3000/candidate-callback',
        runtimeTargetUrl: 'api-primary-dev',
      },
    });

    expect(skeleton).toMatchObject({
      status: 'environment_rejected',
      enabled: false,
      clientCandidateReady: false,
      clientCreated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
    });
    expect(skeleton.blockers).toEqual(expect.arrayContaining([
      'supabase_project_rejected',
      'auth_callback_rejected',
    ]));
    expect(skeleton.guards.supabaseProject.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'project_url_invalid',
      'service_role_not_browser_safe',
    ]));
    expect(skeleton.guards.authCallback.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'callback_url_unsafe',
      'provider_not_enabled',
    ]));
  });

  it('does not echo secret-like browser config values', () => {
    const skeleton = buildPhase19eAuthClientSkeleton({
      enabled: true,
      supabaseProject: {
        enabled: true,
        environment: 'production',
        projectUrl: 'https://project.supabase.co',
        anonKey: 'synthetic-anon-key',
        browserConfig: { serviceRoleValue: 'synthetic-secret-value' },
      },
      authCallback: {
        enabled: true,
        providerCandidate: 'supabase-auth-candidate',
        environment: 'production',
        callbackUrl: 'https://app.ironpath.example/candidate-callback',
        browserConfig: { providerToken: 'synthetic-sensitive-value' },
      },
    });

    const serialized = JSON.stringify(skeleton);
    expect(serialized).not.toContain('synthetic-secret-value');
    expect(serialized).not.toContain('synthetic-sensitive-value');
    expect(skeleton.blockers).toEqual(expect.arrayContaining([
      'supabase_project_rejected',
      'auth_callback_rejected',
    ]));
  });

  it('keeps auth actions passive and never reports fake success', () => {
    const skeleton = buildPhase19eAuthClientSkeleton(safeInput());

    expect(skeleton.signIn()).toEqual({
      ok: false,
      action: 'sign_in',
      status: 'unsupported',
      errorCode: 'auth_runtime_deferred',
      message: 'Auth runtime remains deferred in Phase 19E.',
      networkAttempted: false,
      localStorageChanged: false,
      sourceOfTruthChanged: false,
      secretsExposed: false,
    });
    expect(skeleton.signOut()).toMatchObject({
      ok: false,
      action: 'sign_out',
      status: 'unsupported',
      errorCode: 'auth_runtime_deferred',
      networkAttempted: false,
      localStorageChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('does not mutate input objects', () => {
    const input = safeInput();
    const before = JSON.stringify(input);

    buildPhase19eAuthClientSkeleton(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});
